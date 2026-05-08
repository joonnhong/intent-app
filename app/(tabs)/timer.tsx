import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from 'react-native-svg';

import { CeramicButton } from '../../components/intent/CeramicButton';
import {
  applyPartialRewardAndFailure,
  applySuccess,
  calculateRewardPoints,
  getSoundEffectsEnabled,
  recordSession,
} from '../../services/storage';
import { colors, radius, shadows, spacing, typography } from '../../constants/theme';

const ACTIVE_SESSION_KEY = 'intent.activeSession.v1';
// Set to false before production release so sessions use the selected real duration.
const TEST_MODE = true;
const TEST_DURATION_SECONDS = 10;
const DEFAULT_DURATION_SECONDS = 30 * 60;
const STILL_THRESHOLD = 0.08;
const SENSOR_INTERVAL_MS = 350;
const MOVEMENT_WARNING_SECONDS = 5;
const MAX_PENALTY_COUNT = 5;
const PENALTY_MESSAGE_MS = 2200;
const RESUMED_MESSAGE_MS = 2200;
const SUCCESS_SOUND = require('../../assets/sounds/success.mp3');
const WARNING_SOUND = require('../../assets/sounds/warning.mp3');
const END_SOUND = require('../../assets/sounds/end.mp3');
const TOTAL_PROGRESS_TICKS = 48;
const PROGRESS_SEGMENTS = Array.from({ length: TOTAL_PROGRESS_TICKS }, (_, index) => index);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type LedTone = 'orange' | 'sage';

type HardwareLedProps = {
  isPulsing: boolean;
  pulseOpacity: Animated.Value;
  tone: LedTone;
};

type HardwareProgressRingProps = {
  activeTickCount: number;
  tone: LedTone;
};

const HardwareProgressRing = memo(function HardwareProgressRing({ activeTickCount, tone }: HardwareProgressRingProps) {
  const activeColor = tone === 'sage' ? colors.sage : colors.orange;
  const center = 124;
  const innerRadius = 105;
  const outerRadius = 111;

  return (
    <View pointerEvents="none" style={styles.progressRing}>
      <Svg width={248} height={248} viewBox="0 0 248 248">
        {PROGRESS_SEGMENTS.map((tickIndex) => {
          const angle = (-90 + (360 / TOTAL_PROGRESS_TICKS) * tickIndex) * (Math.PI / 180);
          const x1 = center + Math.cos(angle) * innerRadius;
          const y1 = center + Math.sin(angle) * innerRadius;
          const x2 = center + Math.cos(angle) * outerRadius;
          const y2 = center + Math.sin(angle) * outerRadius;
          const isActiveTick = tickIndex < activeTickCount;

          return (
            <Line
              key={tickIndex}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isActiveTick ? activeColor : colors.faint}
              strokeOpacity={isActiveTick ? 0.54 : 0.07}
              strokeWidth={isActiveTick ? 1.35 : 1}
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
    </View>
  );
});
const HardwareLed = memo(function HardwareLed({ isPulsing, pulseOpacity, tone }: HardwareLedProps) {
  const toneColor = tone === 'sage' ? colors.sage : colors.orange;
  const animatedOpacity = pulseOpacity as unknown as number;
  const glowOpacity = isPulsing ? animatedOpacity : 1;

  return (
    <View pointerEvents="none" style={styles.ledLight}>
      <Svg width={44} height={44} viewBox="0 0 44 44">
        <Defs>
          <RadialGradient id="ledSurfaceTint" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={toneColor} stopOpacity="0.12" />
            <Stop offset="48%" stopColor={toneColor} stopOpacity="0.045" />
            <Stop offset="100%" stopColor={toneColor} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="ledOuterGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={toneColor} stopOpacity="0.32" />
            <Stop offset="34%" stopColor={toneColor} stopOpacity="0.12" />
            <Stop offset="100%" stopColor={toneColor} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="ledMidGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={toneColor} stopOpacity="0.34" />
            <Stop offset="58%" stopColor={toneColor} stopOpacity="0.13" />
            <Stop offset="100%" stopColor={toneColor} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="ledInnerGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={toneColor} stopOpacity="0.42" />
            <Stop offset="70%" stopColor={toneColor} stopOpacity="0.2" />
            <Stop offset="100%" stopColor={toneColor} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="ledCore" cx="36%" cy="34%" r="68%">
            <Stop offset="0%" stopColor="#F0EEE9" stopOpacity="0.95" />
            <Stop offset="24%" stopColor={toneColor} stopOpacity="1" />
            <Stop offset="100%" stopColor={toneColor} stopOpacity="0.96" />
          </RadialGradient>
        </Defs>

        <Circle cx="22" cy="22" r="20" fill="url(#ledSurfaceTint)" />
        <AnimatedCircle cx="22" cy="22" r="21" fill="url(#ledOuterGlow)" opacity={glowOpacity} />
        <AnimatedCircle cx="22" cy="22" r="14" fill="url(#ledMidGlow)" opacity={glowOpacity} />
        <Circle cx="22" cy="22" r="8" fill="url(#ledInnerGlow)" />
        <Circle cx="22" cy="22" r="3" fill="url(#ledCore)" />
        <Circle cx="20.9" cy="20.7" r="0.75" fill="#F0EEE9" opacity="0.86" />
      </Svg>
    </View>
  );
});
type SessionStatus = 'loading' | 'running' | 'success' | 'ended';
type EndReason = 'manual' | 'penalties';
type AccelerationReading = {
  x: number;
  y: number;
  z: number;
};
type ActiveSession = {
  sessionId: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  rewardPoints: number;
  countdownDurationSeconds: number;
  penaltyCount: number;
  purpose?: string;
  note?: string;
};

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatCompletedDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function getParamNumber(value: string | string[] | undefined, fallback: number) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const numberValue = Number(rawValue);

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
}

function getRemainingSeconds(endTime: number) {
  return Math.max(0, Math.floor((endTime - Date.now()) / 1000));
}

function normalizeActiveSession(value: Partial<ActiveSession> | null): ActiveSession | null {
  if (!value) {
    return null;
  }

  const sessionId = typeof value.sessionId === 'string' && value.sessionId.trim().length > 0
    ? value.sessionId.trim()
    : '';
  const startTime = typeof value.startTime === 'number' ? value.startTime : 0;
  const endTime = typeof value.endTime === 'number' ? value.endTime : 0;
  const durationSeconds = typeof value.durationSeconds === 'number' ? value.durationSeconds : 0;
  const rewardPoints = typeof value.rewardPoints === 'number' ? value.rewardPoints : 0;
  const countdownDurationSeconds = typeof value.countdownDurationSeconds === 'number'
    ? value.countdownDurationSeconds
    : durationSeconds;
  const penaltyCount = typeof value.penaltyCount === 'number' ? value.penaltyCount : 0;
  const purpose = typeof value.purpose === 'string' && value.purpose.trim().length > 0
    ? value.purpose.trim()
    : undefined;
  const note = typeof value.note === 'string' && value.note.trim().length > 0
    ? value.note.trim()
    : undefined;

  if (![startTime, endTime, durationSeconds, rewardPoints, countdownDurationSeconds, penaltyCount].every(Number.isFinite)) {
    return null;
  }

  if (!sessionId || startTime <= 0 || endTime <= startTime || durationSeconds <= 0 || countdownDurationSeconds <= 0) {
    return null;
  }

  return {
    sessionId,
    startTime,
    endTime,
    durationSeconds,
    rewardPoints,
    countdownDurationSeconds,
    penaltyCount: Math.max(0, penaltyCount),
    purpose,
    note,
  };
}

async function clearActiveSession() {
  try {
    await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    // Cleanup should not interrupt the completion flow.
  }
}

async function getStoredActiveSession(routeSessionId?: string) {
  try {
    const storedSession = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);

    if (!storedSession) {
      return null;
    }

    const normalizedSession = normalizeActiveSession(JSON.parse(storedSession) as Partial<ActiveSession>);

    if (!normalizedSession) {
      await clearActiveSession();
      return null;
    }

    if (routeSessionId && normalizedSession.sessionId !== routeSessionId) {
      await clearActiveSession();
      return null;
    }

    return normalizedSession;
  } catch {
    await clearActiveSession();
    return null;
  }
}

async function saveActiveSession(session: ActiveSession) {
  try {
    await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Persistence should not interrupt the timer UI.
  }
}

async function playSessionSound(source: number, isEnabled: boolean, soundName?: 'success' | 'warning' | 'end') {
  if (!isEnabled) {
    return;
  }

  try {
    const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true });

    sound.setOnPlaybackStatusUpdate((status: { didJustFinish?: boolean }) => {
      if (status.didJustFinish) {
        void sound.unloadAsync().catch(() => undefined);
      }
    });
  } catch (error) {
    if (soundName === 'warning') {
      console.warn('warning sound failed', error);
    }
    // Missing placeholder files, web playback limits, or unavailable audio should not interrupt sessions.
  }
}

async function playWarningEntryHaptic() {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    await Haptics.selectionAsync();
  } catch {
    // Warning entry haptics are optional and should never interrupt tracking.
  }
}

async function playNotificationHaptic(type: Haptics.NotificationFeedbackType) {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    await Haptics.notificationAsync(type);
  } catch {
    // Haptics are optional feedback and should never interrupt the timer flow.
  }
}

export default function TimerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    sessionId?: string;
    durationSeconds?: string;
    rewardPoints?: string;
    purpose?: string;
    note?: string;
  }>();
  const rawRouteSessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const generatedSessionIdRef = useRef(`session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const routeSessionId = typeof rawRouteSessionId === 'string' && rawRouteSessionId.trim().length > 0
    ? rawRouteSessionId.trim()
    : generatedSessionIdRef.current;
  const paramDurationSeconds = getParamNumber(params.durationSeconds, DEFAULT_DURATION_SECONDS);
  const paramRewardPoints = getParamNumber(
    params.rewardPoints,
    calculateRewardPoints(Math.round(paramDurationSeconds / 60))
  );
  const paramCountdownDurationSeconds = TEST_MODE ? TEST_DURATION_SECONDS : paramDurationSeconds;
  const rawSessionPurpose = Array.isArray(params.purpose) ? params.purpose[0] : params.purpose;
  const sessionPurpose = typeof rawSessionPurpose === 'string' && rawSessionPurpose.trim().length > 0
    ? rawSessionPurpose.trim()
    : undefined;
  const rawSessionNote = Array.isArray(params.note) ? params.note[0] : params.note;
  const sessionNote = typeof rawSessionNote === 'string' && rawSessionNote.trim().length > 0
    ? rawSessionNote.trim()
    : undefined;
  const [sessionDurationSeconds, setSessionDurationSeconds] = useState(paramDurationSeconds);
  const [sessionRewardPoints, setSessionRewardPoints] = useState(paramRewardPoints);
  const [remainingSeconds, setRemainingSeconds] = useState(paramCountdownDurationSeconds);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [isStill, setIsStill] = useState(true);
  const [isWarning, setIsWarning] = useState(false);
  const [penaltyCount, setPenaltyCount] = useState(0);
  const [partialPoints, setPartialPoints] = useState(0);
  const [completedSeconds, setCompletedSeconds] = useState(0);
  const [endReason, setEndReason] = useState<EndReason>('manual');
  const [showPenaltyMessage, setShowPenaltyMessage] = useState(false);
  const [showResumedMessage, setShowResumedMessage] = useState(false);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPlayedWarningEntryHapticRef = useRef(false);
  const penaltyMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumedMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStoredResultRef = useRef(false);
  const startTimeRef = useRef(0);
  const endTimeRef = useRef(0);
  const sessionDurationSecondsRef = useRef(paramDurationSeconds);
  const sessionRewardPointsRef = useRef(paramRewardPoints);
  const countdownDurationSecondsRef = useRef(paramCountdownDurationSeconds);
  const penaltyCountRef = useRef(0);
  const statusRef = useRef<SessionStatus>('loading');
  const soundEffectsEnabledRef = useRef(true);
  const sessionPurposeRef = useRef(sessionPurpose);
  const sessionNoteRef = useRef(sessionNote);
  const indicatorPulseOpacity = useRef(new Animated.Value(1)).current;

  const syncActiveSessionState = useCallback((session: ActiveSession) => {
    startTimeRef.current = session.startTime;
    endTimeRef.current = session.endTime;
    sessionDurationSecondsRef.current = session.durationSeconds;
    sessionRewardPointsRef.current = session.rewardPoints;
    countdownDurationSecondsRef.current = session.countdownDurationSeconds;
    penaltyCountRef.current = session.penaltyCount;
    sessionPurposeRef.current = session.purpose;
    sessionNoteRef.current = session.note;

    setSessionDurationSeconds(session.durationSeconds);
    setSessionRewardPoints(session.rewardPoints);
    setPenaltyCount(session.penaltyCount);
    setRemainingSeconds(getRemainingSeconds(session.endTime));
  }, []);

  const completeSuccess = useCallback(() => {
    if (hasStoredResultRef.current) {
      return;
    }

    hasStoredResultRef.current = true;
    setRemainingSeconds(0);
    setStatus('success');
    setIsWarning(false);
    setShowPenaltyMessage(false);
    setShowResumedMessage(false);
    void playNotificationHaptic(Haptics.NotificationFeedbackType.Success);
    void playSessionSound(SUCCESS_SOUND, soundEffectsEnabledRef.current, 'success');
    void clearActiveSession();
    void applySuccess(Math.round(sessionDurationSecondsRef.current / 60));
    void recordSession({
      durationSeconds: sessionDurationSecondsRef.current,
      completedSeconds: getActualElapsedSeconds(),
      status: 'success',
      pointsEarned: sessionRewardPointsRef.current,
      penaltyCount: penaltyCountRef.current,
      purpose: sessionPurposeRef.current,
      note: sessionNoteRef.current,
    });
  }, []);

  const updateRemainingFromClock = useCallback(() => {
    if (statusRef.current !== 'running' || endTimeRef.current <= 0) {
      return;
    }

    const nextRemainingSeconds = getRemainingSeconds(endTimeRef.current);
    setRemainingSeconds(nextRemainingSeconds);

    if (nextRemainingSeconds <= 0) {
      completeSuccess();
    }
  }, [completeSuccess]);

  const getActualElapsedSeconds = () => {
    if (startTimeRef.current <= 0) {
      return 0;
    }

    return Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000));
  };

  const endSessionWithPartialReward = useCallback((reason: EndReason, nextPenaltyCount = penaltyCountRef.current) => {
    if (hasStoredResultRef.current) {
      return;
    }

    const nextCompletedSeconds = getActualElapsedSeconds();
    const completedRatio = sessionDurationSecondsRef.current > 0
      ? Math.min(1, nextCompletedSeconds / sessionDurationSecondsRef.current)
      : 0;
    const nextPartialPoints = Math.round(sessionRewardPointsRef.current * completedRatio * 0.25);

    hasStoredResultRef.current = true;
    setCompletedSeconds(nextCompletedSeconds);
    setPartialPoints(nextPartialPoints);
    setEndReason(reason);
    setStatus('ended');
    setIsWarning(false);
    setShowPenaltyMessage(false);
    setShowResumedMessage(false);
    void clearActiveSession();
    void playSessionSound(END_SOUND, soundEffectsEnabledRef.current, 'end');
    void applyPartialRewardAndFailure(nextPartialPoints);
    void recordSession({
      durationSeconds: sessionDurationSecondsRef.current,
      completedSeconds: nextCompletedSeconds,
      status: reason === 'penalties' ? 'ended' : 'partial',
      pointsEarned: nextPartialPoints,
      penaltyCount: nextPenaltyCount,
      purpose: sessionPurposeRef.current,
      note: sessionNoteRef.current,
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initializeSession() {
      const storedSession = await getStoredActiveSession(routeSessionId);
      const now = Date.now();
      const nextSession: ActiveSession = storedSession ?? {
        sessionId: routeSessionId,
        startTime: now,
        endTime: now + paramCountdownDurationSeconds * 1000,
        durationSeconds: paramDurationSeconds,
        rewardPoints: paramRewardPoints,
        countdownDurationSeconds: paramCountdownDurationSeconds,
        penaltyCount: 0,
        purpose: sessionPurpose,
        note: sessionNote,
      };

      if (!storedSession) {
        await saveActiveSession(nextSession);
      }

      if (!isMounted) {
        return;
      }

      hasStoredResultRef.current = false;
      statusRef.current = 'loading';
      setStatus('loading');
      setRemainingSeconds(getRemainingSeconds(nextSession.endTime));
      setIsStill(true);
      setIsWarning(false);
      setPenaltyCount(nextSession.penaltyCount);
      penaltyCountRef.current = nextSession.penaltyCount;
      setPartialPoints(0);
      setCompletedSeconds(0);
      setEndReason('manual');
      setShowPenaltyMessage(false);
      syncActiveSessionState(nextSession);

      if (storedSession) {
        setShowResumedMessage(true);

        if (resumedMessageTimeoutRef.current) {
          clearTimeout(resumedMessageTimeoutRef.current);
        }

        resumedMessageTimeoutRef.current = setTimeout(() => {
          setShowResumedMessage(false);
          resumedMessageTimeoutRef.current = null;
        }, RESUMED_MESSAGE_MS);
      }

      if (getRemainingSeconds(nextSession.endTime) <= 0) {
        statusRef.current = 'running';
        setStatus('running');
        completeSuccess();
      } else {
        setStatus('running');
      }
    }

    void initializeSession();

    return () => {
      isMounted = false;
    };
  }, [completeSuccess, paramCountdownDurationSeconds, paramDurationSeconds, paramRewardPoints, routeSessionId, sessionNote, sessionPurpose, syncActiveSessionState]);

  useEffect(() => {
    let isMounted = true;

    getSoundEffectsEnabled().then((isEnabled) => {
      if (isMounted) {
        soundEffectsEnabledRef.current = isEnabled;
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    penaltyCountRef.current = penaltyCount;
  }, [penaltyCount]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (status !== 'running') {
      indicatorPulseOpacity.stopAnimation();
      indicatorPulseOpacity.setValue(1);
      return;
    }

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(indicatorPulseOpacity, {
          toValue: 0.12,
          duration: 820,
          useNativeDriver: true,
        }),
        Animated.timing(indicatorPulseOpacity, {
          toValue: 1,
          duration: 820,
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();

    return () => {
      pulseAnimation.stop();
      indicatorPulseOpacity.setValue(1);
    };
  }, [indicatorPulseOpacity, status]);


  useEffect(() => {
    sessionDurationSecondsRef.current = sessionDurationSeconds;
  }, [sessionDurationSeconds]);

  useEffect(() => {
    sessionRewardPointsRef.current = sessionRewardPoints;
  }, [sessionRewardPoints]);

  useEffect(() => {
    if (status !== 'running') {
      return;
    }

    updateRemainingFromClock();
    const intervalId = setInterval(updateRemainingFromClock, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [status, updateRemainingFromClock]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        updateRemainingFromClock();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [updateRemainingFromClock]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (statusRef.current !== 'running' || hasStoredResultRef.current) {
          return;
        }

        const nextCompletedSeconds = getActualElapsedSeconds();
        const completedRatio = sessionDurationSecondsRef.current > 0
          ? Math.min(1, nextCompletedSeconds / sessionDurationSecondsRef.current)
          : 0;
        const nextPartialPoints = Math.round(sessionRewardPointsRef.current * completedRatio * 0.25);

        hasStoredResultRef.current = true;
        void clearActiveSession();
        void playSessionSound(END_SOUND, soundEffectsEnabledRef.current, 'end');
        void applyPartialRewardAndFailure(nextPartialPoints);
        void recordSession({
          durationSeconds: sessionDurationSecondsRef.current,
          completedSeconds: nextCompletedSeconds,
          status: 'partial',
          pointsEarned: nextPartialPoints,
          penaltyCount: penaltyCountRef.current,
          purpose: sessionPurposeRef.current,
          note: sessionNoteRef.current,
        });
      };
    }, [])
  );

  useEffect(() => {
    if (status !== 'running') {
      return;
    }

    if (Platform.OS === 'web') {
      setIsStill(true);
      return;
    }

    let lastReading: AccelerationReading | null = null;
    let isSubscribed = true;
    let subscription: { remove: () => void } | null = null;

    Accelerometer.isAvailableAsync()
      .then((isAvailable) => {
        if (!isSubscribed || !isAvailable) {
          setIsStill(true);
          return;
        }

        Accelerometer.setUpdateInterval(SENSOR_INTERVAL_MS);
        subscription = Accelerometer.addListener((reading) => {
          if (!lastReading) {
            lastReading = reading;
            setIsStill(true);
            return;
          }

          const movementDelta =
            Math.abs(reading.x - lastReading.x) +
            Math.abs(reading.y - lastReading.y) +
            Math.abs(reading.z - lastReading.z);

          setIsStill(movementDelta < STILL_THRESHOLD);
          lastReading = reading;
        });
      })
      .catch(() => {
        setIsStill(true);
      });

    return () => {
      isSubscribed = false;
      subscription?.remove();
    };
  }, [status]);

  useEffect(() => {
    return () => {
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }

      if (penaltyMessageTimeoutRef.current) {
        clearTimeout(penaltyMessageTimeoutRef.current);
        penaltyMessageTimeoutRef.current = null;
      }

      if (resumedMessageTimeoutRef.current) {
        clearTimeout(resumedMessageTimeoutRef.current);
        resumedMessageTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (status !== 'running') {
      setIsWarning(false);
      setShowPenaltyMessage(false);
      setShowResumedMessage(false);
      hasPlayedWarningEntryHapticRef.current = false;

      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }

      return;
    }

    if (isStill) {
      setIsWarning(false);
      hasPlayedWarningEntryHapticRef.current = false;

      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }

      return;
    }

    if (!hasPlayedWarningEntryHapticRef.current) {
      hasPlayedWarningEntryHapticRef.current = true;
      void playWarningEntryHaptic();
    }

    setIsWarning(true);

    if (!warningTimeoutRef.current) {
      warningTimeoutRef.current = setTimeout(() => {
        warningTimeoutRef.current = null;
        void playNotificationHaptic(Haptics.NotificationFeedbackType.Warning);
        const nextPenaltyCount = penaltyCountRef.current + 1;

        if (nextPenaltyCount >= MAX_PENALTY_COUNT) {
          setPenaltyCount(nextPenaltyCount);
          penaltyCountRef.current = nextPenaltyCount;
          endSessionWithPartialReward('penalties', nextPenaltyCount);
          return;
        }

        const countdownPenaltySeconds = Math.round(countdownDurationSecondsRef.current * 0.15);
        const nextEndTime = endTimeRef.current + countdownPenaltySeconds * 1000;
        const nextSession: ActiveSession = {
          sessionId: routeSessionId,
          startTime: startTimeRef.current,
          endTime: nextEndTime,
          durationSeconds: sessionDurationSecondsRef.current,
          rewardPoints: sessionRewardPointsRef.current,
          countdownDurationSeconds: countdownDurationSecondsRef.current,
          penaltyCount: nextPenaltyCount,
          purpose: sessionPurposeRef.current,
          note: sessionNoteRef.current,
        };

        void playSessionSound(WARNING_SOUND, soundEffectsEnabledRef.current, 'warning');
        endTimeRef.current = nextEndTime;
        penaltyCountRef.current = nextPenaltyCount;
        setPenaltyCount(nextPenaltyCount);
        setRemainingSeconds(getRemainingSeconds(nextEndTime));
        void saveActiveSession(nextSession);
        setIsWarning(false);
        setIsStill(true);
        hasPlayedWarningEntryHapticRef.current = false;
        setShowResumedMessage(false);
        setShowPenaltyMessage(true);

        if (penaltyMessageTimeoutRef.current) {
          clearTimeout(penaltyMessageTimeoutRef.current);
        }

        penaltyMessageTimeoutRef.current = setTimeout(() => {
          setShowPenaltyMessage(false);
          penaltyMessageTimeoutRef.current = null;
        }, PENALTY_MESSAGE_MS);
      }, MOVEMENT_WARNING_SECONDS * 1000);
    }

    return () => {
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
    };
  }, [endSessionWithPartialReward, isStill, routeSessionId, status]);

  const isSuccess = status === 'success';
  const isEnded = status === 'ended';
  const isLoading = status === 'loading';
  const trackingMessage = showPenaltyMessage
    ? 'Penalty added: +15% time'
    : showResumedMessage
    ? 'Resumed active session'
    : isWarning
    ? 'Hold still within 5 seconds to continue.'
    : 'Tracking active - phone is resting.';
  const message = isLoading
    ? 'Restoring session...'
    : isSuccess
    ? 'Session complete'
    : isEnded && endReason === 'penalties'
    ? 'Session ended after too many penalties'
    : isEnded
    ? 'Session ended'
    : trackingMessage;
  const resultButtonLabel = isSuccess ? 'Back home' : 'Done';
  const completedDurationLabel = formatCompletedDuration(completedSeconds);
  const selectedDurationSeconds = Math.max(1, sessionDurationSeconds);
  const countdownDurationSeconds = Math.max(1, countdownDurationSecondsRef.current);
  const countdownProgress = Math.min(
    1,
    Math.max(0, (countdownDurationSeconds - remainingSeconds) / countdownDurationSeconds)
  );
  const uiCompletedSeconds = isSuccess
    ? selectedDurationSeconds
    : isEnded
    ? completedSeconds
    : TEST_MODE
    ? selectedDurationSeconds * countdownProgress
    : Math.max(0, sessionDurationSeconds - remainingSeconds);
  const progress = Math.min(1, Math.max(0, uiCompletedSeconds / selectedDurationSeconds));
  const activeTickCount = isSuccess
    ? TOTAL_PROGRESS_TICKS
    : Math.floor(progress * TOTAL_PROGRESS_TICKS);

  const resultTitle = isSuccess
    ? 'Session complete'
    : isEnded && endReason === 'penalties'
    ? 'Too many penalties'
    : 'Session ended';
  const resultPoints = isSuccess ? sessionRewardPoints : partialPoints;

  const handleFailedPress = () => {
    void playNotificationHaptic(Haptics.NotificationFeedbackType.Error);
    endSessionWithPartialReward('manual');
  };

  const handleHomePress = () => {
    router.replace('/');
  };

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        isSuccess && styles.successBackground,
        isEnded && styles.endedBackground,
      ]}>
      <View style={styles.container}>
        <View style={styles.devicePanel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelLabel}>INTENT FOCUS</Text>
            {status === 'running' ? (
              <View style={styles.penaltyPill}>
                <Text style={styles.penaltyPillText}>PENALTY {penaltyCount}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.timerWrap}>
            <View style={styles.dialStage}>
              <View style={styles.dialOuter}>
                <View style={styles.dialGroove}>
                  <HardwareProgressRing
                    activeTickCount={activeTickCount}
                    tone={isEnded ? 'orange' : 'sage'}
                  />

                  <View style={styles.dialCenter}>
                    <View pointerEvents="none" style={styles.dialSurfaceTopLight} />
                    <View pointerEvents="none" style={styles.dialSurfaceInnerRim} />
                    <HardwareLed
                      isPulsing={status === 'running'}
                      pulseOpacity={indicatorPulseOpacity}
                      tone={isSuccess ? 'sage' : 'orange'}
                    />
                    <Text
                      style={[
                        styles.timerText,
                        isSuccess && styles.successText,
                        isEnded && styles.endedText,
                      ]}>
                      {formatTime(remainingSeconds)}
                    </Text>
                    <Text style={[styles.dialSubLabel, isSuccess && styles.successText, isEnded && styles.endedText]}>
                      {isLoading ? 'RESTORE' : isEnded ? 'ENDED' : isSuccess ? 'DONE' : 'ACTIVE'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.statusArea}>
              {!isSuccess && !isEnded ? (
                <Text
                  style={[
                    styles.statusLabel,
                    status === 'running' &&
                      (isWarning || showPenaltyMessage || showResumedMessage) &&
                      styles.warningText,
                  ]}>
                  {message}
                </Text>
              ) : (
                <View style={styles.resultStrip}>
                  <Text style={[styles.resultTitle, isSuccess && styles.successText, isEnded && styles.endedText]}>
                    {resultTitle}
                  </Text>
                  <Text style={[styles.resultValue, isSuccess && styles.successText, isEnded && styles.endedText]}>
                    +{resultPoints} pts
                  </Text>
                  {isEnded ? <Text style={styles.resultMeta}>Completed {completedDurationLabel}</Text> : null}
                </View>
              )}
            </View>
          </View>

          <View style={styles.actionArea}>
            {status === 'running' ? (
              <CeramicButton
                size="medium"
                onPress={handleFailedPress}
                surfaceStyle={styles.actionButtonSurface}>
                <Text style={styles.failButtonText}>I failed</Text>
              </CeramicButton>
            ) : status === 'loading' ? (
              <View style={styles.actionPlaceholder} />
            ) : (
              <CeramicButton
                size="medium"
                onPress={handleHomePress}
                surfaceStyle={styles.actionButtonSurface}>
                <Text style={[styles.homeButtonText, isEnded && styles.endedHomeButtonText]}>
                  {resultButtonLabel}
                </Text>
              </CeramicButton>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  successBackground: {
    backgroundColor: colors.successSoft,
  },
  endedBackground: {
    backgroundColor: colors.warningSoft,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    justifyContent: 'center',
  },
  devicePanel: {
    flex: 1,
    maxHeight: 590,

    borderRadius: radius.panel,
    backgroundColor: colors.panel,
    padding: spacing.panelPadding,
    justifyContent: 'space-between',
    ...shadows.panel,
  },
  panelHeader: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelLabel: {
    ...typography.panelLabel,
    color: colors.ink,
  },
  timerWrap: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingBottom: 0,
  },
  dialStage: {
    height: 292,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialOuter: {
    width: 276,
    height: 276,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.dial,
    backgroundColor: colors.surfaceInset,
    borderWidth: 0,
    ...shadows.dial,
  },
  progressRing: {
    position: 'absolute',
    width: 248,
    height: 248,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialGroove: {
    width: 248,
    height: 248,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.dial,
    backgroundColor: colors.surfaceInset,
    borderWidth: 0,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 1,
  },
  dialCenter: {
    width: 204,
    height: 204,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.dial,
    backgroundColor: colors.surface,
    borderWidth: 0,

    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  dialSurfaceTopLight: {
    position: 'absolute',
    top: 10,
    left: 26,
    width: 88,
    height: 54,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  dialSurfaceInnerRim: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderRadius: radius.dial,
    borderWidth: 0,

  },
  ledLight: {
    position: 'absolute',
    top: 16,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    ...typography.timerValue,
    color: colors.ink,
    fontSize: 46,
    letterSpacing: 0.1,
  },
  dialSubLabel: {
    ...typography.panelLabel,
    color: colors.faint,
    opacity: 0.42,
    marginTop: spacing.xs,
  },
  penaltyPill: {
    borderWidth: 0,
    borderTopColor: 'rgba(255,255,255,0.78)',
    borderLeftColor: colors.line,
    borderRightColor: colors.line,
    borderBottomColor: 'rgba(17,19,18,0.16)',
    borderRadius: radius.smallButton,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: '#000000',
    shadowOpacity: 0.13,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  penaltyPillText: {
    ...typography.instrumentLabel,
    color: colors.muted,
  },
  statusArea: {
    height: 88,
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  statusLabel: {
    ...typography.panelLabel,
    color: colors.muted,
    maxWidth: 280,
    marginTop: spacing.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
  resultStrip: {
    minWidth: 220,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: radius.control,
    backgroundColor: 'transparent',
    marginTop: 0,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
  },
  resultTitle: {
    ...typography.instrumentLabel,
    color: colors.ink,
    fontSize: 13,
  },
  resultValue: {
    fontFamily: typography.valueLarge.fontFamily,
    color: colors.ink,
    fontSize: 22,
    marginTop: spacing.xs,
  },
  resultMeta: {
    ...typography.meta,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  actionArea: {
    height: 64,
    justifyContent: 'flex-end',
  },
  actionPlaceholder: {
    height: 52,
  },
  actionButtonSurface: {
    minHeight: 52,
    minWidth: 168,
    paddingHorizontal: spacing.xl,
  },
  failButtonText: {
    ...typography.button,
    color: colors.orange,
    fontSize: 16,
  },
  homeButtonText: {
    ...typography.button,
    color: colors.ink,
    fontSize: 16,
  },
  endedHomeButtonText: {
    color: colors.orange,
  },
  successText: {
    color: colors.sage,
  },
  endedText: {
    color: colors.orange,
  },
  warningText: {
    color: colors.orange,
  },
});












































