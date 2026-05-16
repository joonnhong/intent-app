import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, InteractionManager, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, FeGaussianBlur, FeMerge, FeMergeNode, Filter, G, Path, Rect } from 'react-native-svg';

import { CeramicButton } from '../../components/intent/CeramicButton';
import { HardwareLed } from '../../components/intent/HardwareLed';
import {
  applyPartialRewardAndFailure,
  applySuccess,
  calculateRewardPoints,
  getSoundEffectsEnabled,
  recordSession,
} from '../../services/storage';
import { colors, fonts, radius, spacing, typography } from '../../constants/theme';

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

const RESULT_RADIUS = 20;
const RESULT_GAP_INSET = 4;
const RESULT_GAP_RADIUS = RESULT_RADIUS - 2;
const RESULT_INNER_INSET = 5;
const RESULT_INNER_RADIUS = RESULT_RADIUS - 5;

const TOTAL_DOTS = 48;

type HardwareProgressRingProps = {
  progress: number;
  tone: 'sage' | 'orange';
  isComplete: boolean;
};

const HardwareProgressRing = memo(function HardwareProgressRing({
  progress,
  tone,
  isComplete,
}: HardwareProgressRingProps) {
  const size = 276;
  const center = 138;
  const dotRadius = 122;
  const activeCount = isComplete ? TOTAL_DOTS : Math.round(Math.min(progress, 1) * TOTAL_DOTS);
  const activeColor = tone === 'sage' ? colors.sage : colors.orange;

  // Rotating pointer: triangle at the leading edge of progress
  const pointerAngleDeg = -90 + Math.min(Math.max(progress, 0), 0.9999) * 360;
  const pointerAngleRad = pointerAngleDeg * (Math.PI / 180);
  const pCx = center + Math.cos(pointerAngleRad) * dotRadius;
  const pCy = center + Math.sin(pointerAngleRad) * dotRadius;

  return (
    <View pointerEvents="none" style={styles.progressRing}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <Filter id="dotGlow" x="-200%" y="-200%" width="500%" height="500%">
            <FeGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="blur" />
            <FeMerge>
              <FeMergeNode in="blur" />
              <FeMergeNode in="SourceGraphic" />
            </FeMerge>
          </Filter>
          <Filter id="dotGlowStrong" x="-250%" y="-250%" width="600%" height="600%">
            <FeGaussianBlur in="SourceGraphic" stdDeviation="3.2" result="blur" />
            <FeMerge>
              <FeMergeNode in="blur" />
              <FeMergeNode in="SourceGraphic" />
            </FeMerge>
          </Filter>
        </Defs>

        {Array.from({ length: TOTAL_DOTS }, (_, i) => {
          const angleDeg = -90 + (360 / TOTAL_DOTS) * i;
          const angleRad = angleDeg * (Math.PI / 180);
          const cx = center + Math.cos(angleRad) * dotRadius;
          const cy = center + Math.sin(angleRad) * dotRadius;
          const isActive = i < activeCount;

          const midAngleDeg = -90 + (360 / TOTAL_DOTS) * (i + 0.5);
          const midRad = midAngleDeg * (Math.PI / 180);
          const gapCx = center + Math.cos(midRad) * dotRadius;
          const gapCy = center + Math.sin(midRad) * dotRadius;

          return (
            <G key={i}>
              <G transform={`rotate(${midAngleDeg + 90}, ${gapCx}, ${gapCy})`}>
                <Rect
                  x={gapCx - 0.75} y={gapCy - 2.5}
                  width={1.5} height={5}
                  rx={0.75}
                  fill="#FFFFFF"
                  fillOpacity={0.10}
                  stroke="none"
                />
              </G>
              {isActive ? (
                <G transform={`rotate(${angleDeg + 90}, ${cx}, ${cy})`} filter={`url(#${isComplete ? 'dotGlowStrong' : 'dotGlow'})`}>
                  <Rect
                    x={cx - 2.0} y={cy - 7}
                    width={4.0} height={14}
                    rx={2.0}
                    fill={activeColor}
                    fillOpacity={isComplete ? 1 : 0.94}
                    stroke="none"
                  />
                </G>
              ) : (
                <G transform={`rotate(${angleDeg + 90}, ${cx}, ${cy})`}>
                  {/* Recessed groove base — warm gray precision engraving */}
                  <Rect
                    x={cx - 1.6} y={cy - 5.5}
                    width={3.2} height={11}
                    rx={1.6}
                    fill="#C8C5BE"
                    fillOpacity={0.48}
                    stroke="none"
                  />
                  {/* Top-edge specular — light catching the groove rim */}
                  <Rect
                    x={cx - 1.0} y={cy - 5.5}
                    width={2.0} height={4}
                    rx={1.0}
                    fill="#FFFFFF"
                    fillOpacity={0.70}
                    stroke="none"
                  />
                </G>
              )}
            </G>
          );
        })}

        {/* Rotating progress pointer — physical triangular marker with depth */}
        {!isComplete && (
          <>
            {/* Offset shadow gives the marker a raised/physical feel */}
            <G transform={`rotate(${pointerAngleDeg + 90}, ${pCx}, ${pCy})`}>
              <Path
                d={`M ${pCx},${pCy - 11} L ${pCx - 5},${pCy + 9} L ${pCx + 5},${pCy + 9} Z`}
                fill="rgba(0,0,0,0.28)"
                stroke="none"
              />
            </G>
            <G transform={`rotate(${pointerAngleDeg + 90}, ${pCx}, ${pCy})`} filter="url(#dotGlowStrong)">
              <Path
                d={`M ${pCx},${pCy - 12} L ${pCx - 5.5},${pCy + 8} L ${pCx + 5.5},${pCy + 8} Z`}
                fill={activeColor}
                fillOpacity={0.97}
                stroke="none"
              />
            </G>
          </>
        )}
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
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const statusOpacity = useRef(new Animated.Value(1)).current;
  const successTintOpacity = useRef(new Animated.Value(0)).current;
  const endedTintOpacity = useRef(new Animated.Value(0)).current;

  // Track the session ID seen on the previous render. When it changes the
  // component is being reused (tab cache) for a new session, so we reset all
  // result/end-state before the first paint of the new session.
  const prevSessionIdRef = useRef(routeSessionId);
  useLayoutEffect(() => {
    if (prevSessionIdRef.current === routeSessionId) return;
    prevSessionIdRef.current = routeSessionId;
    hasStoredResultRef.current = false;
    statusRef.current = 'loading';
    setStatus('loading');
    setIsWarning(false);
    setShowPenaltyMessage(false);
    setShowResumedMessage(false);
    setPenaltyCount(0);
    setPartialPoints(0);
    setCompletedSeconds(0);
    setEndReason('manual');
    setRemainingSeconds(paramCountdownDurationSeconds);
    resultOpacity.setValue(0);
    statusOpacity.setValue(1);
    successTintOpacity.setValue(0);
    endedTintOpacity.setValue(0);
  }, [routeSessionId, paramCountdownDurationSeconds, resultOpacity, statusOpacity, successTintOpacity, endedTintOpacity]);

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

    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      getSoundEffectsEnabled().then((isEnabled) => {
        if (isMounted) {
          soundEffectsEnabledRef.current = isEnabled;
        }
      });
    });

    return () => {
      isMounted = false;
      interactionHandle.cancel();
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

    // Defer sensor binding until the navigation transition finishes so the
    // animation frame budget is not shared with accelerometer setup overhead.
    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      if (!isSubscribed) return;

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
    });

    return () => {
      isSubscribed = false;
      interactionHandle.cancel();
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

  // Cross-fade between running status and result panel — no layout shift.
  useEffect(() => {
    const showResult = status === 'success' || status === 'ended';
    Animated.parallel([
      Animated.timing(resultOpacity, {
        toValue: showResult ? 1 : 0,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(statusOpacity, {
        toValue: showResult ? 0 : 1,
        duration: showResult ? 180 : 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [status, resultOpacity, statusOpacity]);

  useEffect(() => {
    Animated.timing(successTintOpacity, {
      toValue: status === 'success' ? 1 : 0,
      duration: 440,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [status, successTintOpacity]);

  useEffect(() => {
    Animated.timing(endedTintOpacity, {
      toValue: status === 'ended' ? 1 : 0,
      duration: 440,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [status, endedTintOpacity]);

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
    ? 'Session penalized'
    : isEnded
    ? 'Session quit'
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

  const resultTitle = isSuccess
    ? 'Session complete'
    : isEnded && endReason === 'penalties'
    ? 'Penalized'
    : 'Quit';
  const resultPoints = isSuccess ? sessionRewardPoints : partialPoints;

  const handleFailedPress = () => {
    void playNotificationHaptic(Haptics.NotificationFeedbackType.Error);
    endSessionWithPartialReward('manual');
  };

  const handleHomePress = () => {
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Animated background tints — fade in/out independently, no layout impact */}
      <Animated.View pointerEvents="none" style={[styles.bgTintSuccess, { opacity: successTintOpacity }]} />
      <Animated.View pointerEvents="none" style={[styles.bgTintEnded, { opacity: endedTintOpacity }]} />
      <View style={styles.container}>
        <View style={styles.devicePanel}>

          <View style={styles.panelHeader}>
            <Text style={styles.panelLabel}>INTENT FOCUS</Text>
            {status === 'running' ? (
              <LinearGradient
                colors={['#DEDAD0', '#F4F1EA']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.penaltyPillSeat}>
                <LinearGradient
                  pointerEvents="none"
                  colors={['rgba(52,47,39,0.20)', 'rgba(52,47,39,0.07)', 'rgba(52,47,39,0)']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.penaltyPillContactGap}
                />
                <View style={styles.penaltyPillField}>
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(17,19,18,0.07)', 'rgba(17,19,18,0)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.penaltyPillTopShade}
                  />
                  <Text style={styles.penaltyPillText}>PENALTY {penaltyCount}</Text>
                </View>
              </LinearGradient>
            ) : null}
          </View>

          <View style={styles.timerWrap}>
            <View style={styles.dialStage}>
              <View style={styles.dialHousingWrapper}>
                <View pointerEvents="none" style={styles.dialHousingShadow} />
              <LinearGradient
                colors={['#F8F6F0', '#DEDAD0', '#EAE7DF']}
                locations={[0, 0.55, 1]}
                start={{ x: 0.25, y: 0 }}
                end={{ x: 0.75, y: 1 }}
                style={styles.dialOuter}>
                {/* 4-sided contact gap — stronger top, graduated sides and bottom */}
                <LinearGradient
                  pointerEvents="none"
                  colors={['rgba(52,47,39,0.28)', 'rgba(52,47,39,0.13)', 'rgba(52,47,39,0)']}
                  locations={[0, 0.45, 1]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.dialContactGapTop}
                />
                <LinearGradient
                  pointerEvents="none"
                  colors={['rgba(52,47,39,0.14)', 'rgba(52,47,39,0.05)', 'rgba(52,47,39,0)']}
                  start={{ x: 0.5, y: 1 }}
                  end={{ x: 0.5, y: 0 }}
                  style={styles.dialContactGapBottom}
                />
                <LinearGradient
                  pointerEvents="none"
                  colors={['rgba(52,47,39,0.14)', 'rgba(52,47,39,0.04)', 'rgba(52,47,39,0)']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.dialContactGapLeft}
                />
                <LinearGradient
                  pointerEvents="none"
                  colors={['rgba(52,47,39,0.14)', 'rgba(52,47,39,0.04)', 'rgba(52,47,39,0)']}
                  start={{ x: 1, y: 0.5 }}
                  end={{ x: 0, y: 0.5 }}
                  style={styles.dialContactGapRight}
                />
                <Animated.View pointerEvents="none" style={[styles.ringGlowSuccess, { opacity: successTintOpacity }]} />
                <Animated.View pointerEvents="none" style={[styles.ringGlowEnded, { opacity: endedTintOpacity }]} />
                <View style={styles.dialGroove}>
                  <HardwareProgressRing
                    progress={progress}
                    tone={isWarning || isEnded ? 'orange' : 'sage'}
                    isComplete={isSuccess}
                  />
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(0,0,0,0.22)', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0)']}
                    locations={[0, 0.42, 1]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.dialGrooveTopShade}
                  />
                  {/* Specular highlight — machined channel catches light at top */}
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.dialGrooveTopHighlight}
                  />
                  {/* Lateral groove shading — precision-machined channel feel */}
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(0,0,0,0.14)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.14)']}
                    locations={[0, 0.18, 0.82, 1]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.dialGrooveSideShade}
                  />
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.12)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.dialGrooveBottomShade}
                  />
                  <Animated.View pointerEvents="none" style={[styles.ringColorSuccess, { opacity: successTintOpacity }]} />
                  <Animated.View pointerEvents="none" style={[styles.ringColorEnded, { opacity: endedTintOpacity }]} />
                  {/* Constant sage illumination during normal running — dial feels lit from within */}
                  {status === 'running' && !isWarning && (
                    <View pointerEvents="none" style={styles.ringColorRunning} />
                  )}
                  {/* Inner rim ring — bright edge where raised center face meets the recessed channel */}
                  <View pointerEvents="none" style={styles.dialCenterRimRing} />
                  <LinearGradient
                    colors={['#FFFFFF', '#DEDAD2']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.dialCenter}>
                    <LinearGradient
                      pointerEvents="none"
                      colors={['rgba(255,255,255,0.52)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
                      locations={[0, 0.30, 0.65]}
                      start={{ x: 0.18, y: 0 }}
                      end={{ x: 0.82, y: 0.70 }}
                      style={styles.dialSurfaceTopLight}
                    />
                    {/* Top-left directional highlight — raised ceramic disk catches ambient light */}
                    <LinearGradient
                      pointerEvents="none"
                      colors={['rgba(255,255,255,0.45)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']}
                      locations={[0, 0.28, 0.65]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.dialCenterBevelLight}
                    />
                    <LinearGradient
                      pointerEvents="none"
                      colors={['rgba(17,19,18,0.06)', 'rgba(17,19,18,0)', 'rgba(17,19,18,0)', 'rgba(17,19,18,0.06)']}
                      locations={[0, 0.22, 0.78, 1]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={styles.dialCenterSideVignette}
                    />
                    <LinearGradient
                      pointerEvents="none"
                      colors={['rgba(17,19,18,0)', 'rgba(17,19,18,0.05)']}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      style={styles.dialCenterBottomVignette}
                    />
                    <LinearGradient
                      pointerEvents="none"
                      colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.42)', 'rgba(255,255,255,0.42)', 'rgba(255,255,255,0)']}
                      locations={[0, 0.2, 0.8, 1]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={styles.dialCenterBottomGlint}
                    />
                    {/* Bottom-right contact shadow — opposite of top-left highlight completes bevel illusion */}
                    <LinearGradient
                      pointerEvents="none"
                      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.06)', 'rgba(0,0,0,0.13)']}
                      locations={[0, 0.55, 1]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.dialCenterBevelShadow}
                    />
                    {/* Inner flat display surface — centered within the gradient bevel ring */}
                    <View style={styles.dialCenterField}>
                      <LinearGradient
                        pointerEvents="none"
                        colors={['rgba(17,19,18,0.07)', 'rgba(17,19,18,0)']}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={styles.dialCenterFieldTopShade}
                      />
                      {/* Digit slot backing — four recessed windows behind the time digits */}
                      <View pointerEvents="none" style={styles.digitSlots}>
                        <View style={styles.digitSlot} />
                        <View style={styles.digitSlot} />
                        <View style={styles.digitSlotColon} />
                        <View style={styles.digitSlot} />
                        <View style={styles.digitSlot} />
                      </View>
                      <View pointerEvents="none" style={styles.ledLight}>
                        <HardwareLed
                          size="small"
                          isOn
                          tone={isSuccess ? 'sage' : isWarning ? 'orange' : 'sage'}
                          pulseOpacity={status === 'running' ? indicatorPulseOpacity : undefined}
                        />
                      </View>
                      <Text
                        style={[
                          styles.timerText,
                          isSuccess && styles.successText,
                          isEnded && styles.endedText,
                          isWarning && styles.warningText,
                        ]}>
                        {formatTime(remainingSeconds)}
                      </Text>
                      <Text style={[styles.dialSubLabel, isSuccess && styles.successText, isEnded && styles.endedText, isWarning && styles.warningText]}>
                        {isLoading ? 'RESTORE' : isEnded ? 'ENDED' : isSuccess ? 'DONE' : 'ACTIVE'}
                      </Text>
                    </View>
                  </LinearGradient>
                </View>
              </LinearGradient>
              </View>
            </View>

            {/* Fixed-height status zone — dial position never shifts between states */}
            <View style={styles.statusArea}>
              <Animated.View
                style={[styles.statusLayer, { opacity: statusOpacity }]}
                pointerEvents={isSuccess || isEnded ? 'none' : 'box-none'}>
                <Text
                  style={[
                    styles.statusLabel,
                    status === 'running' &&
                      (isWarning || showPenaltyMessage || showResumedMessage) &&
                      styles.warningText,
                  ]}>
                  {message}
                </Text>
                {sessionPurpose && status === 'running' && !isWarning && !showPenaltyMessage ? (
                  <Text style={styles.purposeTag}>#{sessionPurpose}</Text>
                ) : null}
              </Animated.View>

              <Animated.View
                style={[styles.resultLayer, { opacity: resultOpacity }]}
                pointerEvents={isSuccess || isEnded ? 'auto' : 'none'}>
                <LinearGradient
                  colors={['#DEDAD0', '#E3E0D7', '#ECEAE2', '#F4F2EB', '#FDFAF5']}
                  locations={[0, 0.22, 0.48, 0.76, 1]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.resultSeat}>
                  <LinearGradient pointerEvents="none" colors={['rgba(52,47,39,0.18)', 'rgba(52,47,39,0.08)', 'rgba(52,47,39,0.02)', 'rgba(52,47,39,0)']} locations={[0, 0.3, 0.7, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.resultGapTop} />
                  <LinearGradient pointerEvents="none" colors={['rgba(52,47,39,0.10)', 'rgba(52,47,39,0.04)', 'rgba(52,47,39,0)']} locations={[0, 0.5, 1]} start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0 }} style={styles.resultGapBottom} />
                  <LinearGradient pointerEvents="none" colors={['rgba(52,47,39,0.10)', 'rgba(52,47,39,0.03)', 'rgba(52,47,39,0)']} locations={[0, 0.5, 1]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.resultGapLeft} />
                  <LinearGradient pointerEvents="none" colors={['rgba(52,47,39,0.10)', 'rgba(52,47,39,0.03)', 'rgba(52,47,39,0)']} locations={[0, 0.5, 1]} start={{ x: 1, y: 0.5 }} end={{ x: 0, y: 0.5 }} style={styles.resultGapRight} />
                  <View pointerEvents="none" style={styles.resultCavityShadow} />
                  <View style={styles.resultField}>
                    <LinearGradient
                      pointerEvents="none"
                      colors={['rgba(17,19,18,0.09)', 'rgba(17,19,18,0.028)', 'rgba(17,19,18,0)']}
                      locations={[0, 0.4, 1]}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      style={styles.resultTopShade}
                    />
                    <View style={styles.resultContent}>
                      <View style={styles.resultStatusRow}>
                        <HardwareLed size="small" isOn tone={isSuccess ? 'sage' : 'orange'} />
                        <Text style={[styles.resultTitle, isSuccess && styles.successText, isEnded && styles.endedText]}>
                          {resultTitle.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.resultValue, isSuccess && styles.successText, isEnded && styles.endedText]}>
                        +{resultPoints} pts
                      </Text>
                      {isEnded ? <Text style={styles.resultMeta}>Completed {completedDurationLabel}</Text> : null}
                    </View>
                  </View>
                </LinearGradient>
              </Animated.View>
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
  bgTintSuccess: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.successSoft,
  },
  bgTintEnded: {
    ...StyleSheet.absoluteFillObject,
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
    justifyContent: 'space-between',
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
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 0.5,
  },
  penaltyPillSeat: {
    borderRadius: 14,
    padding: 3,
    position: 'relative',
  },
  penaltyPillContactGap: {
    position: 'absolute',
    top: 3, right: 3, bottom: 3, left: 3,
    borderRadius: 12,
  },
  penaltyPillField: {
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: '#E4E0D8',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    position: 'relative',
    zIndex: 1,
  },
  penaltyPillTopShade: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 14,
  },
  penaltyPillText: {
    ...typography.instrumentLabel,
    color: colors.muted,
    textShadowColor: 'rgba(0,0,0,0.16)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 0.5,
  },
  timerWrap: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingBottom: 0,
  },
  dialStage: {
    height: 330,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialHousingWrapper: {
    width: 316,
    height: 316,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialHousingShadow: {
    position: 'absolute',
    width: 316,
    height: 316,
    borderRadius: 158,
    backgroundColor: '#E8E5DE',
    shadowColor: '#111312',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  dialOuter: {
    width: 316,
    height: 316,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 158,
    overflow: 'hidden',
  },
  dialContactGapTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 60,
    borderTopLeftRadius: 158,
    borderTopRightRadius: 158,
  },
  dialContactGapBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 48,
    borderBottomLeftRadius: 158,
    borderBottomRightRadius: 158,
  },
  dialContactGapLeft: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 48,
    borderTopLeftRadius: 158,
    borderBottomLeftRadius: 158,
  },
  dialContactGapRight: {
    position: 'absolute',
    right: 0, top: 0, bottom: 0,
    width: 48,
    borderTopRightRadius: 158,
    borderBottomRightRadius: 158,
  },
  progressRing: {
    position: 'absolute',
    width: 276,
    height: 276,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialGroove: {
    width: 276,
    height: 276,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 138,
    backgroundColor: '#2E2C2A',
    overflow: 'hidden',
  },
  dialGrooveTopShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 72,
  },
  dialGrooveTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  dialGrooveSideShade: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
  },
  dialGrooveBottomShade: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 56,
  },
  dialCenter: {
    width: 210,
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.dial,
    overflow: 'hidden',
  },
  dialSurfaceTopLight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 112,
  },
  dialCenterBevelLight: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  dialCenterBevelShadow: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  // Thin bright ring just outside dialCenter — accent at center/channel boundary
  dialCenterRimRing: {
    position: 'absolute',
    width: 218,
    height: 218,
    borderRadius: 109,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  dialCenterSideVignette: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
  },
  dialCenterBottomVignette: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 60,
  },
  dialCenterBottomGlint: {
    position: 'absolute',
    bottom: 2,
    left: 0,
    right: 0,
    height: 1,
  },
  ledLight: {
    position: 'absolute',
    top: 16,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontFamily: fonts.monoBold,
    fontSize: 42,
    lineHeight: 50,
    letterSpacing: 1.5,
    color: colors.ink,
    marginTop: 8,
  },
  dialSubLabel: {
    ...typography.panelLabel,
    color: colors.faint,
    opacity: 0.42,
    marginTop: spacing.xs,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 0.5,
  },
  statusArea: {
    height: 116,
    width: '100%',
    position: 'relative',
  },
  statusLayer: {
    position: 'absolute',
    top: spacing.xs,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 5,
  },
  statusLabel: {
    ...typography.panelLabel,
    color: colors.muted,
    maxWidth: 280,
    marginTop: spacing.xs,
    textAlign: 'center',
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.16)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 0.5,
  },
  purposeTag: {
    ...typography.chip,
    color: colors.sage,
    fontSize: 12,
  },
  resultLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  resultSeat: {
    width: '100%',
    borderRadius: RESULT_RADIUS,
    padding: RESULT_INNER_INSET,
    position: 'relative',
  },
  resultGapTop: {
    position: 'absolute',
    top: RESULT_GAP_INSET, left: RESULT_GAP_INSET, right: RESULT_GAP_INSET,
    height: 18,
    borderTopLeftRadius: RESULT_GAP_RADIUS,
    borderTopRightRadius: RESULT_GAP_RADIUS,
  },
  resultGapBottom: {
    position: 'absolute',
    bottom: RESULT_GAP_INSET, left: RESULT_GAP_INSET, right: RESULT_GAP_INSET,
    height: 14,
    borderBottomLeftRadius: RESULT_GAP_RADIUS,
    borderBottomRightRadius: RESULT_GAP_RADIUS,
  },
  resultGapLeft: {
    position: 'absolute',
    left: RESULT_GAP_INSET, top: RESULT_GAP_INSET, bottom: RESULT_GAP_INSET,
    width: 14,
    borderTopLeftRadius: RESULT_GAP_RADIUS,
    borderBottomLeftRadius: RESULT_GAP_RADIUS,
  },
  resultGapRight: {
    position: 'absolute',
    right: RESULT_GAP_INSET, top: RESULT_GAP_INSET, bottom: RESULT_GAP_INSET,
    width: 14,
    borderTopRightRadius: RESULT_GAP_RADIUS,
    borderBottomRightRadius: RESULT_GAP_RADIUS,
  },
  resultCavityShadow: {
    position: 'absolute',
    top: RESULT_GAP_INSET + 1,
    right: RESULT_GAP_INSET + 1,
    bottom: RESULT_GAP_INSET + 1,
    left: RESULT_GAP_INSET + 1,
    borderRadius: RESULT_GAP_RADIUS - 1,
    backgroundColor: 'rgba(17,19,18,0.018)',
    shadowColor: '#111312',
    shadowOpacity: 0.26,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  resultField: {
    overflow: 'hidden',
    borderRadius: RESULT_INNER_RADIUS,
    backgroundColor: '#E4E0D8',
    paddingHorizontal: 14,
    position: 'relative',
    zIndex: 1,
  },
  resultTopShade: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 22,
  },
  resultContent: {
    alignItems: 'center',
    paddingVertical: 14,
    gap: 3,
  },
  resultStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultTitle: {
    ...typography.instrumentLabel,
    color: colors.ink,
    fontSize: 13,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 0.5,
  },
  resultValue: {
    fontFamily: typography.valueLarge.fontFamily,
    color: 'rgba(17,19,18,0.62)',
    fontSize: 22,
    marginTop: spacing.xs,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 1,
  },
  resultMeta: {
    ...typography.meta,
    color: colors.muted,
    marginTop: spacing.xs,
    textShadowColor: 'rgba(0,0,0,0.16)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 0.5,
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
    fontSize: 14,
    opacity: 0.88,
    textShadowColor: 'rgba(0,0,0,0.16)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 0.5,
  },
  homeButtonText: {
    ...typography.button,
    color: 'rgba(17,19,18,0.68)',
    fontSize: 16,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 1,
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
  // Ring glow — shadow layer sits behind dialGroove; body hidden by groove, only outward halo visible
  ringGlowSuccess: {
    position: 'absolute',
    left: 20,
    top: 20,
    width: 276,
    height: 276,
    borderRadius: 138,
    backgroundColor: '#2E2C2A',
    shadowColor: '#5DFF3A',
    shadowRadius: 26,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
  },
  ringGlowEnded: {
    position: 'absolute',
    left: 20,
    top: 20,
    width: 276,
    height: 276,
    borderRadius: 138,
    backgroundColor: '#2E2C2A',
    shadowColor: '#FF4040',
    shadowRadius: 26,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
  },
  // Ring color wash — tints the groove channel; dialCenter renders on top hiding the center
  ringColorSuccess: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(62,173,2,0.45)',
  },
  ringColorEnded: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(210,45,20,0.50)',
  },
  ringColorRunning: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(79,125,112,0.18)',
  },
  // Inner display surface — centered within dialCenter gradient bevel ring
  dialCenterField: {
    width: 178,
    height: 178,
    borderRadius: 999,
    backgroundColor: '#F4F2EE',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialCenterFieldTopShade: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 28,
  },
  // Digit slot backing — recessed window frames behind each time digit
  digitSlots: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    top: 60,
    left: 0,
    right: 0,
    justifyContent: 'center',
    gap: 3,
  },
  digitSlot: {
    width: 28,
    height: 46,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.065)',
  },
  digitSlotColon: {
    width: 10,
    height: 46,
  },
});












































