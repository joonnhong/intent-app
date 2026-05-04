import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  applyPartialReward,
  applySuccess,
  calculateRewardPoints,
  recordSession,
} from '../../services/storage';

// Set this to false before production release.
const TEST_MODE = true;
const DEFAULT_DURATION_SECONDS = 30 * 60;
const TEST_DURATION_SECONDS = 10;
const STILL_THRESHOLD = 0.08;
const SENSOR_INTERVAL_MS = 350;
const MOVEMENT_WARNING_SECONDS = 5;
const MAX_PENALTY_COUNT = 5;
const PENALTY_MESSAGE_MS = 2200;

type SessionStatus = 'running' | 'success' | 'ended';
type EndReason = 'manual' | 'penalties';
type AccelerationReading = {
  x: number;
  y: number;
  z: number;
};

const colors = {
  background: '#F6F3EA',
  surface: '#FFFFFF',
  ink: '#1F2723',
  muted: '#69746F',
  sage: '#4C7A6D',
  sageSoft: '#DDE9E3',
  clay: '#B8664B',
  claySoft: '#F0DDD5',
  line: '#E6E0D2',
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
    durationSeconds?: string;
    rewardPoints?: string;
  }>();
  const sessionDurationSeconds = getParamNumber(params.durationSeconds, DEFAULT_DURATION_SECONDS);
  const sessionDurationMinutes = Math.round(sessionDurationSeconds / 60);
  const sessionRewardPoints = calculateRewardPoints(sessionDurationMinutes);
  const initialCountdownSeconds = TEST_MODE ? TEST_DURATION_SECONDS : sessionDurationSeconds;
  const penaltySeconds = Math.round(sessionDurationSeconds * 0.15);
  const countdownPenaltySeconds = TEST_MODE ? TEST_DURATION_SECONDS * 0.15 : penaltySeconds;
  const [remainingSeconds, setRemainingSeconds] = useState(initialCountdownSeconds);
  const [status, setStatus] = useState<SessionStatus>('running');
  const [isStill, setIsStill] = useState(true);
  const [isWarning, setIsWarning] = useState(false);
  const [penaltyCount, setPenaltyCount] = useState(0);
  const [partialPoints, setPartialPoints] = useState(0);
  const [completedSeconds, setCompletedSeconds] = useState(0);
  const [endReason, setEndReason] = useState<EndReason>('manual');
  const [showPenaltyMessage, setShowPenaltyMessage] = useState(false);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const penaltyMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStoredResultRef = useRef(false);
  const remainingSecondsRef = useRef(initialCountdownSeconds);
  const penaltyCountRef = useRef(0);
  const statusRef = useRef<SessionStatus>('running');

  useFocusEffect(
    useCallback(() => {
      setRemainingSeconds(initialCountdownSeconds);
      setStatus('running');
      setIsStill(true);
      setIsWarning(false);
      setPenaltyCount(0);
      setPartialPoints(0);
      setCompletedSeconds(0);
      setEndReason('manual');
      setShowPenaltyMessage(false);
      hasStoredResultRef.current = false;

      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }

      if (penaltyMessageTimeoutRef.current) {
        clearTimeout(penaltyMessageTimeoutRef.current);
        penaltyMessageTimeoutRef.current = null;
      }
    }, [initialCountdownSeconds])
  );

  useEffect(() => {
    remainingSecondsRef.current = remainingSeconds;
  }, [remainingSeconds]);

  useEffect(() => {
    penaltyCountRef.current = penaltyCount;
  }, [penaltyCount]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (status !== 'running') {
      return;
    }

    const intervalId = setInterval(() => {
      setRemainingSeconds((currentSeconds) => {
        if (currentSeconds <= 1) {
          clearInterval(intervalId);
          void playNotificationHaptic(Haptics.NotificationFeedbackType.Success);

          if (!hasStoredResultRef.current) {
            hasStoredResultRef.current = true;
            void applySuccess(sessionDurationMinutes);
            void recordSession({
              durationSeconds: sessionDurationSeconds,
              completedSeconds: sessionDurationSeconds,
              status: 'success',
              pointsEarned: sessionRewardPoints,
              penaltyCount: penaltyCountRef.current,
            });
          }

          setStatus('success');
          return 0;
        }

        return currentSeconds - 1;
      });
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [sessionDurationMinutes, sessionDurationSeconds, sessionRewardPoints, status]);

  const getCompletedSessionSeconds = useCallback(
    (currentRemainingSeconds: number) => {
      const remainingRatio = TEST_MODE
        ? currentRemainingSeconds / initialCountdownSeconds
        : currentRemainingSeconds / sessionDurationSeconds;
      const remainingSessionSeconds = Math.max(
        0,
        Math.min(sessionDurationSeconds, Math.round(remainingRatio * sessionDurationSeconds))
      );

      return Math.max(0, Math.min(sessionDurationSeconds, sessionDurationSeconds - remainingSessionSeconds));
    },
    [initialCountdownSeconds, sessionDurationSeconds]
  );

  const endSessionWithPartialReward = useCallback(
    (currentRemainingSeconds: number, reason: EndReason, nextPenaltyCount = penaltyCountRef.current) => {
      if (hasStoredResultRef.current) {
        return;
      }

      const nextCompletedSeconds = getCompletedSessionSeconds(currentRemainingSeconds);
      const completedRatio = sessionDurationSeconds > 0 ? nextCompletedSeconds / sessionDurationSeconds : 0;
      const nextPartialPoints = Math.round(sessionRewardPoints * completedRatio * 0.25);

      hasStoredResultRef.current = true;
      setCompletedSeconds(nextCompletedSeconds);
      setPartialPoints(nextPartialPoints);
      setEndReason(reason);
      setStatus('ended');
      setIsWarning(false);
      setShowPenaltyMessage(false);
      void applyPartialReward(nextPartialPoints);
      void recordSession({
        durationSeconds: sessionDurationSeconds,
        completedSeconds: nextCompletedSeconds,
        status: reason === 'penalties' ? 'ended' : 'partial',
        pointsEarned: nextPartialPoints,
        penaltyCount: nextPenaltyCount,
      });
    },
    [getCompletedSessionSeconds, sessionDurationSeconds, sessionRewardPoints]
  );

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (statusRef.current !== 'running' || hasStoredResultRef.current) {
          return;
        }

        const nextCompletedSeconds = getCompletedSessionSeconds(remainingSecondsRef.current);
        const completedRatio = sessionDurationSeconds > 0 ? nextCompletedSeconds / sessionDurationSeconds : 0;
        const nextPartialPoints = Math.round(sessionRewardPoints * completedRatio * 0.25);

        hasStoredResultRef.current = true;
        void applyPartialReward(nextPartialPoints);
        void recordSession({
          durationSeconds: sessionDurationSeconds,
          completedSeconds: nextCompletedSeconds,
          status: 'partial',
          pointsEarned: nextPartialPoints,
          penaltyCount: penaltyCountRef.current,
        });
      };
    }, [getCompletedSessionSeconds, sessionDurationSeconds, sessionRewardPoints])
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
    };
  }, []);

  useEffect(() => {
    if (status !== 'running') {
      setIsWarning(false);
      setShowPenaltyMessage(false);

      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }

      return;
    }

    if (isStill) {
      setIsWarning(false);

      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }

      return;
    }

    setIsWarning(true);

    if (!warningTimeoutRef.current) {
      warningTimeoutRef.current = setTimeout(() => {
        warningTimeoutRef.current = null;
        void playNotificationHaptic(Haptics.NotificationFeedbackType.Warning);
        setRemainingSeconds((currentSeconds) => {
          const nextPenaltyCount = penaltyCount + 1;

          if (nextPenaltyCount >= MAX_PENALTY_COUNT) {
            endSessionWithPartialReward(currentSeconds, 'penalties', nextPenaltyCount);
            return currentSeconds;
          }

          return currentSeconds + countdownPenaltySeconds;
        });
        setPenaltyCount((currentCount) => currentCount + 1);
        setIsWarning(false);
        setIsStill(true);
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
  }, [countdownPenaltySeconds, endSessionWithPartialReward, isStill, penaltyCount, status]);

  const isSuccess = status === 'success';
  const isEnded = status === 'ended';
  const displayRemainingSeconds = TEST_MODE
    ? Math.max(
        0,
        Math.round((remainingSeconds / initialCountdownSeconds) * sessionDurationSeconds)
      )
    : remainingSeconds;
  const trackingMessage = showPenaltyMessage
    ? 'Penalty added: +15% time'
    : isWarning
    ? 'Hold still within 5 seconds to continue.'
    : 'Tracking active \u2014 phone is resting.';
  const message = isSuccess
    ? 'Session complete \uD83C\uDF89'
    : isEnded && endReason === 'penalties'
    ? 'Session ended after too many penalties'
    : isEnded
    ? 'Session ended'
    : trackingMessage;
  const resultButtonLabel = isSuccess ? 'Back home' : 'Done';
  const completedDurationLabel = formatCompletedDuration(completedSeconds);

  const handleFailedPress = () => {
    void playNotificationHaptic(Haptics.NotificationFeedbackType.Error);
    endSessionWithPartialReward(remainingSeconds, 'manual');
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
        <View style={styles.timerWrap}>
          <View
            style={[
              styles.timerRing,
              isSuccess && styles.successRing,
              isEnded && styles.endedRing,
            ]}>
            <Text
              style={[
                styles.timerText,
                isSuccess && styles.successText,
                isEnded && styles.endedText,
              ]}>
              {formatTime(displayRemainingSeconds)}
            </Text>
          </View>

          {status === 'running' ? (
            <View style={styles.penaltyPill}>
              <Text style={styles.penaltyPillText}>Penalties: {penaltyCount}</Text>
            </View>
          ) : null}

          <Text
            style={[
              styles.caption,
              status === 'running' && (isWarning || showPenaltyMessage) && styles.warningText,
              isSuccess && styles.successText,
              isEnded && styles.endedText,
            ]}>
            {message}
          </Text>

          {isSuccess ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>+{sessionRewardPoints} points earned</Text>
              <Text style={styles.resultBody}>Daily streak updated</Text>
            </View>
          ) : null}

          {isEnded ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>Partial reward earned</Text>
              <Text style={styles.partialRewardText}>+{partialPoints} points</Text>
              <Text style={styles.resultBody}>You completed {completedDurationLabel}</Text>
            </View>
          ) : null}
        </View>

        {status === 'running' ? (
          <Pressable
            onPress={handleFailedPress}
            style={({ pressed }) => [styles.failButton, pressed && styles.buttonPressed]}>
            <Text style={styles.failButtonText}>I failed</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleHomePress}
            style={({ pressed }) => [
              styles.homeButton,
              isEnded && styles.endedHomeButton,
              pressed && styles.buttonPressed,
            ]}>
            <Text style={[styles.homeButtonText, isEnded && styles.endedHomeButtonText]}>
              {resultButtonLabel}
            </Text>
          </Pressable>
        )}
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
    backgroundColor: colors.sageSoft,
  },
  endedBackground: {
    backgroundColor: colors.claySoft,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
  },
  timerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerRing: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 110,
    backgroundColor: colors.surface,
  },
  successRing: {
    borderColor: colors.sage,
  },
  endedRing: {
    borderColor: colors.clay,
  },
  timerText: {
    color: colors.ink,
    fontSize: 54,
    fontWeight: '900',
  },
  penaltyPill: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    backgroundColor: colors.surface,
    marginTop: 22,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  penaltyPillText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '900',
  },
  caption: {
    marginTop: 28,
    color: colors.muted,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 26,
    textAlign: 'center',
  },
  resultCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.surface,
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  resultTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  resultBody: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 15,
    fontWeight: '800',
  },
  partialRewardText: {
    marginTop: 8,
    color: colors.clay,
    fontSize: 22,
    fontWeight: '900',
  },
  failButton: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.claySoft,
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  failButtonText: {
    color: colors.clay,
    fontSize: 16,
    fontWeight: '900',
  },
  homeButton: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.sage,
  },
  endedHomeButton: {
    backgroundColor: colors.claySoft,
    borderWidth: 1,
    borderColor: colors.clay,
  },
  homeButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '900',
  },
  endedHomeButtonText: {
    color: colors.clay,
  },
  successText: {
    color: colors.sage,
  },
  endedText: {
    color: colors.clay,
  },
  warningText: {
    color: colors.clay,
  },
});
