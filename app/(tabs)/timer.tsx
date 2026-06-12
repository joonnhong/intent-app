import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { createAudioPlayer, type AudioStatus } from 'expo-audio';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  Image,
  InteractionManager,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CeramicButton } from '../../components/intent/CeramicButton';
import { HardwareLed } from '../../components/intent/HardwareLed';
import { MotionSeismographStrip } from '../../components/intent/MotionSeismographStrip';
import { RollingCounter } from '../../components/intent/RollingCounter';
import { TimerDial, TIMER_DIAL_SIZE, type TimerDialVisualState } from '../../components/intent/TimerDial';
import {
  applyPartialRewardAndFailure,
  applySuccess,
  calculateRewardPoints,
  DEFAULT_TIMER_TEST_MODE_ENABLED,
  getSoundEffectsEnabled,
  getTimerTestModeEnabled,
  recordSession,
} from '../../services/storage';
import { SCREEN_HORIZONTAL_PADDING, colors, spacing, typography } from '../../constants/theme';

const ACTIVE_SESSION_KEY = 'intent.activeSession.v1';
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

const TIMER_ACTION_BUTTON_HEIGHT = 58;
const TIMER_ACTION_AREA_HEIGHT = 68;
const TIMER_ACTION_BOTTOM_OFFSET = 46;
const TIMER_ACTION_COMPACT_BOTTOM_OFFSET = 28;
const TIMER_ACTION_COMPACT_SCREEN_HEIGHT = 820;
const TIMER_HEADER_TOP_OFFSET = 2;
const TIMER_BLOCK_OFFSET_Y = 22;
const RESULT_RADIUS = 20;
const RESULT_GAP_INSET = 4;
const RESULT_GAP_RADIUS = RESULT_RADIUS - 2;
const RESULT_INNER_INSET = 5;
const RESULT_INNER_RADIUS = RESULT_RADIUS - 5;
const HEADER_GROOVE_TOP = -6;
const HEADER_GROOVE_HEIGHT = 2;
const SPEAKER_CLUSTER_WIDTH = 104.4;
const SPEAKER_CLUSTER_HEIGHT = 23.8;
const SPEAKER_HOLE_SIZE = 4.8;
const SPEAKER_CLUSTER_PATTERN = [16, 16, 16, 16];
const SPEAKER_CLUSTER_TOP = -46;
const SPEAKER_CLUSTER_SIDE_OFFSET = 0;
const SPEAKER_HOLE_ASSET = require('../../assets/speaker-grille/speaker-hole.png');

type SpeakerHolePosition = {
  x: number;
  y: number;
};

const SPEAKER_CLUSTER_COLUMNS = Math.max(...SPEAKER_CLUSTER_PATTERN);
const SPEAKER_CLUSTER_ROWS = SPEAKER_CLUSTER_PATTERN.length;
const SPEAKER_HOLE_GAP_X = (SPEAKER_CLUSTER_WIDTH - SPEAKER_CLUSTER_COLUMNS * SPEAKER_HOLE_SIZE) / (SPEAKER_CLUSTER_COLUMNS - 1);
const SPEAKER_HOLE_GAP_Y = (SPEAKER_CLUSTER_HEIGHT - SPEAKER_CLUSTER_ROWS * SPEAKER_HOLE_SIZE) / (SPEAKER_CLUSTER_ROWS - 1);

function createSpeakerClusterPositions(): SpeakerHolePosition[] {
  return SPEAKER_CLUSTER_PATTERN.flatMap((columns, rowIndex) => {
    const rowWidth = columns * SPEAKER_HOLE_SIZE + (columns - 1) * SPEAKER_HOLE_GAP_X;
    const rowStartX = (SPEAKER_CLUSTER_WIDTH - rowWidth) / 2;
    const y = rowIndex * (SPEAKER_HOLE_SIZE + SPEAKER_HOLE_GAP_Y);

    return Array.from({ length: columns }, (_, columnIndex) => ({
      x: rowStartX + columnIndex * (SPEAKER_HOLE_SIZE + SPEAKER_HOLE_GAP_X),
      y,
    }));
  });
}

const SPEAKER_GRILLE_POSITIONS = createSpeakerClusterPositions();

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

function SpeakerGrille({ position }: { position: 'left' | 'center' | 'right' }) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.speakerGrille,
        position === 'left'
          ? styles.speakerGrilleLeft
          : position === 'center'
          ? styles.speakerGrilleCenter
          : styles.speakerGrilleRight,
      ]}>
      {SPEAKER_GRILLE_POSITIONS.map((hole) => (
        <Image
          key={`speaker-hole-${hole.x}-${hole.y}`}
          source={SPEAKER_HOLE_ASSET}
          resizeMode="contain"
          style={[styles.speakerHole, { left: hole.x, top: hole.y }]}
        />
      ))}
    </View>
  );
}

function DecorativeGroove({ style }: { style: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[styles.decorativeGroove, style]}>
      <View style={styles.decorativeGrooveShade} />
      <View style={styles.decorativeGrooveHighlight} />
    </View>
  );
}

function HardwareDecorations() {
  return (
    <View pointerEvents="none" style={styles.decorationLayer}>
      <SpeakerGrille position="left" />
      <SpeakerGrille position="center" />
      <SpeakerGrille position="right" />
      <DecorativeGroove style={styles.decorativeGrooveHeader} />
      <DecorativeGroove style={styles.decorativeGrooveLeft} />
      <DecorativeGroove style={styles.decorativeGrooveRight} />
      <DecorativeGroove style={styles.decorativeGrooveLower} />
    </View>
  );
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

function formatTimerDisplay(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
    const player = createAudioPlayer(source, {
      keepAudioSessionActive: false,
      updateInterval: 250,
    });
    let didRemovePlayer = false;
    let cleanupTimeout: ReturnType<typeof setTimeout> | undefined;
    let subscription: { remove: () => void } | undefined;

    const cleanupPlayer = () => {
      if (didRemovePlayer) {
        return;
      }

      didRemovePlayer = true;

      if (cleanupTimeout) {
        clearTimeout(cleanupTimeout);
      }

      subscription?.remove();

      try {
        player.remove();
      } catch {
        // Player cleanup is best-effort for short sound effects.
      }
    };

    subscription = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
      if (status.didJustFinish) {
        cleanupPlayer();
      }
    });

    player.play();
    cleanupTimeout = setTimeout(cleanupPlayer, 8000);
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
  const isTimerFocused = useIsFocused();
  const { height: screenHeight } = useWindowDimensions();
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
  const [isTestModeEnabled, setIsTestModeEnabled] = useState(DEFAULT_TIMER_TEST_MODE_ENABLED);
  const [hasLoadedTestMode, setHasLoadedTestMode] = useState(false);
  const paramCountdownDurationSeconds = isTestModeEnabled ? TEST_DURATION_SECONDS : paramDurationSeconds;
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
  const [movementLevel, setMovementLevel] = useState(0);
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
    setMovementLevel(0);
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
    setMovementLevel(0);
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
    setMovementLevel(0);
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
    setHasLoadedTestMode(false);

    getTimerTestModeEnabled()
      .then((isEnabled) => {
        if (isMounted) {
          setIsTestModeEnabled(isEnabled);
        }
      })
      .finally(() => {
        if (isMounted) {
          setHasLoadedTestMode(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [routeSessionId]);

  useEffect(() => {
    if (!hasLoadedTestMode) {
      return;
    }

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
      setMovementLevel(0);
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
  }, [completeSuccess, hasLoadedTestMode, paramCountdownDurationSeconds, paramDurationSeconds, paramRewardPoints, routeSessionId, sessionNote, sessionPurpose, syncActiveSessionState]);

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
    if (status !== 'running' || !isTimerFocused) {
      setIsStill(true);
      setMovementLevel(0);
      return;
    }

    if (Platform.OS === 'web') {
      setIsStill(true);
      setMovementLevel(0);
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
            setMovementLevel(0);
            return;
          }

          Accelerometer.setUpdateInterval(SENSOR_INTERVAL_MS);
          subscription = Accelerometer.addListener((reading) => {
            if (!lastReading) {
              lastReading = reading;
              setIsStill(true);
              setMovementLevel(0);
              return;
            }

            const movementDelta =
              Math.abs(reading.x - lastReading.x) +
              Math.abs(reading.y - lastReading.y) +
              Math.abs(reading.z - lastReading.z);

            setIsStill(movementDelta < STILL_THRESHOLD);
            setMovementLevel(Math.min(1, movementDelta / 0.28));
            lastReading = reading;
          });
        })
        .catch(() => {
          setIsStill(true);
          setMovementLevel(0);
        });
    });

    return () => {
      isSubscribed = false;
      interactionHandle.cancel();
      subscription?.remove();
    };
  }, [isTimerFocused, status]);

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
    if (status !== 'running' || !isTimerFocused) {
      setIsWarning(false);
      setShowPenaltyMessage(false);
      setShowResumedMessage(false);
      setIsStill(true);
      setMovementLevel(0);
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
  }, [endSessionWithPartialReward, isStill, isTimerFocused, routeSessionId, status]);

  // Cross-fade between running status and result panel ??no layout shift.
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
  const countdownDurationSeconds = Math.max(1, countdownDurationSecondsRef.current);
  const dialElapsedSeconds = Math.max(0, countdownDurationSeconds - remainingSeconds);
  const dialProgress = Math.min(1, dialElapsedSeconds / countdownDurationSeconds);
  const dialRemainingTime = formatTimerDisplay(isSuccess ? 0 : remainingSeconds);
  const dialVisualState: TimerDialVisualState = isLoading
    ? 'loading'
    : isSuccess
    ? 'success'
    : isEnded && endReason === 'penalties'
    ? 'failed'
    : isEnded
    ? 'ended'
    : isWarning
    ? 'warning'
    : 'running';
  const resultTitle = isSuccess
    ? 'Session complete'
    : isEnded && endReason === 'penalties'
    ? 'Penalized'
    : 'Quit';
  const resultPoints = isSuccess ? sessionRewardPoints : partialPoints;
  const statusTranslateY = statusOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [-4, 0],
  });
  const resultTranslateY = resultOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });
  const actionBottomOffset = screenHeight < TIMER_ACTION_COMPACT_SCREEN_HEIGHT
    ? TIMER_ACTION_COMPACT_BOTTOM_OFFSET
    : TIMER_ACTION_BOTTOM_OFFSET;

  const handleFailedPress = () => {
    void playNotificationHaptic(Haptics.NotificationFeedbackType.Error);
    endSessionWithPartialReward('manual');
  };

  const handleHomePress = () => {
    router.replace('/session');
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      {/* Animated background tints ??fade in/out independently, no layout impact */}
      <Animated.View pointerEvents="none" style={[styles.bgTintSuccess, { opacity: successTintOpacity }]} />
      <Animated.View pointerEvents="none" style={[styles.bgTintEnded, { opacity: endedTintOpacity }]} />
      <View style={styles.container}>
        <View style={styles.devicePanel}>
          <HardwareDecorations />

          <View style={styles.panelHeader}>
            <Text style={styles.panelLabel}>ANCHOR FOCUS</Text>
            <View style={styles.penaltyReadout}>
              <Text style={styles.penaltyReadoutLabel}>PENALTY</Text>
              <View style={styles.penaltyCounterWindow}>
                <View style={styles.penaltyCounterScale}>
                  <RollingCounter value={penaltyCount} digits={1} maxValue={MAX_PENALTY_COUNT} noComma />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.timerWrap}>
            <View style={styles.dialStage}>
              <TimerDial
                size={TIMER_DIAL_SIZE}
                progress={dialProgress}
                remainingTime={dialRemainingTime}
                visualState={dialVisualState}
                penaltyCount={penaltyCount}
                isStill={isStill}
              />
            </View>

            {/* Fixed-height status zone ??dial position never shifts between states */}
            <View style={styles.statusArea}>
              <MotionSeismographStrip
                movementLevel={movementLevel}
                isActive={status === 'running'}
                isWarning={isWarning || showPenaltyMessage}
                resetKey={routeSessionId}
              />

              <Animated.View
                style={[styles.statusLayer, { opacity: statusOpacity, transform: [{ translateY: statusTranslateY }] }]}
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
              </Animated.View>

              <Animated.View
                style={[styles.resultLayer, { opacity: resultOpacity, transform: [{ translateY: resultTranslateY }] }]}
                pointerEvents={isSuccess || isEnded ? 'auto' : 'none'}>
                <View style={styles.resultReadout}>
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
              </Animated.View>
            </View>
          </View>

          <View style={[styles.actionArea, { transform: [{ translateY: actionBottomOffset }] }]}>
            {status === 'running' ? (
              <CeramicButton
                size="medium"
                onPress={handleFailedPress}
                surfaceStyle={styles.actionButtonSurface}>
                <Text style={styles.failButtonText} numberOfLines={1}>Quit</Text>
              </CeramicButton>
            ) : status === 'loading' ? (
              <View style={styles.actionPlaceholder} />
            ) : (
              <CeramicButton
                size="medium"
                onPress={handleHomePress}
                surfaceStyle={styles.actionButtonSurface}>
                <Text style={[styles.homeButtonText, isEnded && styles.endedHomeButtonText]} numberOfLines={1}>
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
    backgroundColor: 'rgba(79,125,112,0.035)',
  },
  bgTintEnded: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingTop: 0,
    paddingBottom: spacing.sm,
    justifyContent: 'center',
  },
  devicePanel: {
    flex: 1,
    width: '100%',
    maxHeight: 590,
    justifyContent: 'flex-start',
    position: 'relative',
  },
  decorationLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  speakerGrille: {
    position: 'absolute',
    top: SPEAKER_CLUSTER_TOP,
    width: SPEAKER_CLUSTER_WIDTH,
    height: SPEAKER_CLUSTER_HEIGHT,
  },
  speakerGrilleLeft: {
    left: SPEAKER_CLUSTER_SIDE_OFFSET,
  },
  speakerGrilleCenter: {
    left: '50%',
    transform: [{ translateX: -SPEAKER_CLUSTER_WIDTH / 2 }],
  },
  speakerGrilleRight: {
    right: SPEAKER_CLUSTER_SIDE_OFFSET,
  },
  speakerHole: {
    position: 'absolute',
    width: SPEAKER_HOLE_SIZE,
    height: SPEAKER_HOLE_SIZE,
  },
  decorativeGroove: {
    position: 'absolute',
    height: 4,
    overflow: 'hidden',
    borderRadius: 999,
    opacity: 0.48,
  },
  decorativeGrooveShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(52,47,39,0.17)',
  },
  decorativeGrooveHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(246,243,236,0.34)',
  },
  decorativeGrooveLeft: {
    left: 2,
    bottom: 248,
    width: 52,
    transform: [{ rotate: '-6deg' }],
  },
  decorativeGrooveRight: {
    right: 4,
    bottom: 222,
    width: 44,
    transform: [{ rotate: '7deg' }],
  },
  decorativeGrooveLower: {
    left: '50%',
    bottom: 58,
    width: 86,
    transform: [{ translateX: -43 }],
    opacity: 0.34,
  },
  decorativeGrooveHeader: {
    top: HEADER_GROOVE_TOP,
    left: -SCREEN_HORIZONTAL_PADDING,
    right: -SCREEN_HORIZONTAL_PADDING,
    height: HEADER_GROOVE_HEIGHT,
    opacity: 0.68,
    backgroundColor: 'rgba(52,47,39,0.045)',
    shadowColor: '#111312',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  panelHeader: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    transform: [{ translateY: TIMER_HEADER_TOP_OFFSET }],
  },
  panelLabel: {
    ...typography.panelLabel,
    color: colors.ink,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 0.5,
  },
  penaltyReadout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    minWidth: 92,
  },
  penaltyReadoutLabel: {
    ...typography.instrumentLabel,
    color: colors.muted,
    textShadowColor: 'rgba(0,0,0,0.16)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 0.5,
  },
  penaltyCounterWindow: {
    width: 22,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  penaltyCounterScale: {
    transform: [{ scale: 0.66 }],
  },
  timerWrap: {
    height: 494,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingBottom: 0,
    transform: [{ translateY: TIMER_BLOCK_OFFSET_Y }],
  },
  dialStage: {
    height: 338,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  statusArea: {
    height: 156,
    width: '100%',
    position: 'relative',
  },
  statusLayer: {
    position: 'absolute',
    top: 108,
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
    top: 94,
    left: 0,
    right: 0,
    height: '100%',
    justifyContent: 'flex-start',
  },
  resultReadout: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  resultSeat: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
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
    paddingTop: 0,
    gap: 0,
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
    marginTop: 0,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 1,
  },
  resultMeta: {
    ...typography.meta,
    color: colors.muted,
    marginTop: 0,
    textShadowColor: 'rgba(0,0,0,0.16)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 0.5,
  },
  actionArea: {
    height: TIMER_ACTION_AREA_HEIGHT,
    justifyContent: 'flex-end',
    marginTop: 'auto',
  },
  actionPlaceholder: {
    height: TIMER_ACTION_BUTTON_HEIGHT,
  },
  actionButtonSurface: {
    gap: 5,
    minWidth: 168,
    paddingLeft: 0,
    paddingRight: 12,
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
});



































