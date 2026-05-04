import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  calculateAchievements,
  calculateRewardPoints,
  getSessionHistory,
  getStats,
  type Achievement,
  type SessionRecord,
} from '../services/storage';

const colors = {
  background: '#F6F3EA',
  surface: '#FFFFFF',
  ink: '#1F2723',
  muted: '#69746F',
  sage: '#4C7A6D',
  sageSoft: '#DDE9E3',
  line: '#E6E0D2',
};

const MIN_DURATION_MINUTES = 5;
const MAX_DURATION_MINUTES = 12 * 60;
const DEFAULT_DURATION_MINUTES = 30;
const HOUR_OPTIONS = Array.from({ length: 13 }, (_, index) => index);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => index);
const WHEEL_ITEM_HEIGHT = 46;
const WHEEL_VISIBLE_ITEMS = 5;
const WHEEL_PICKER_HEIGHT = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ITEMS;
const WHEEL_CENTER_OFFSET = (WHEEL_PICKER_HEIGHT - WHEEL_ITEM_HEIGHT) / 2;

function clampDuration(minutes: number) {
  return Math.min(MAX_DURATION_MINUTES, Math.max(MIN_DURATION_MINUTES, minutes));
}

function splitDuration(durationMinutes: number) {
  return {
    hours: Math.floor(durationMinutes / 60),
    minutes: durationMinutes % 60,
  };
}

function formatTargetTime(durationMinutes: number) {
  const targetDate = new Date(Date.now() + durationMinutes * 60 * 1000);

  return targetDate.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(durationMinutes: number) {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m remaining`;
  }

  if (hours > 0) {
    return `${hours}h remaining`;
  }

  return `${minutes}m remaining`;
}

function formatSessionDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.round((safeSeconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${Math.max(1, minutes)}m`;
}

function formatSessionStatus(status: SessionRecord['status']) {
  if (status === 'success') {
    return 'Success';
  }

  if (status === 'partial') {
    return 'Partial';
  }

  return 'Ended';
}

async function playSelectionHaptic() {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    await Haptics.selectionAsync();
  } catch {
    // Haptics can be unavailable on some devices or simulators.
  }
}

type WheelPickerProps = {
  label: string;
  options: number[];
  scrollRef: RefObject<ScrollView | null>;
  selectedValue: number;
  onChange: (value: number) => void;
};

function WheelPicker({ label, options, scrollRef, selectedValue, onChange }: WheelPickerProps) {
  const endDragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIndex = Math.max(0, options.indexOf(selectedValue));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const activeIndexRef = useRef(selectedIndex);
  const hasAlignedInitialValueRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);

  const clearEndDragTimer = () => {
    if (endDragTimerRef.current) {
      clearTimeout(endDragTimerRef.current);
      endDragTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!hasAlignedInitialValueRef.current) {
      hasAlignedInitialValueRef.current = true;
      activeIndexRef.current = selectedIndex;
      setActiveIndex(selectedIndex);
      requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = true;
        scrollRef.current?.scrollTo({
          animated: false,
          y: selectedIndex * WHEEL_ITEM_HEIGHT,
        });
        requestAnimationFrame(() => {
          isProgrammaticScrollRef.current = false;
        });
      });
    }
  }, [scrollRef, selectedIndex]);

  useEffect(() => {
    return clearEndDragTimer;
  }, []);

  const setActiveWheelIndex = (nextIndex: number, shouldPlayHaptic: boolean) => {
    if (nextIndex !== activeIndexRef.current) {
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);

      if (shouldPlayHaptic) {
        void playSelectionHaptic();
      }
    }
  };

  const getIndexFromScrollOffset = (scrollOffset: number) => {
    const rawIndex = Math.round(scrollOffset / WHEEL_ITEM_HEIGHT);

    return Math.min(options.length - 1, Math.max(0, rawIndex));
  };

  const commitIndex = (nextIndex: number) => {
    const nextValue = options[nextIndex];

    if (typeof nextValue !== 'number') {
      return;
    }

    if (nextValue !== selectedValue) {
      onChange(nextValue);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = getIndexFromScrollOffset(event.nativeEvent.contentOffset.y);

    setActiveWheelIndex(nextIndex, !isProgrammaticScrollRef.current);
  };

  const settleToNearestValue = (scrollOffset: number) => {
    const nextIndex = getIndexFromScrollOffset(scrollOffset);
    const centeredOffset = nextIndex * WHEEL_ITEM_HEIGHT;

    isProgrammaticScrollRef.current = true;
    scrollRef.current?.scrollTo({
      animated: true,
      y: centeredOffset,
    });

    setActiveWheelIndex(nextIndex, false);
    commitIndex(nextIndex);

    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 180);
  };

  const handleScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;

    clearEndDragTimer();
    endDragTimerRef.current = setTimeout(() => {
      settleToNearestValue(offsetY);
    }, 120);
  };

  const handleMomentumScrollBegin = () => {
    clearEndDragTimer();
  };

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    clearEndDragTimer();
    settleToNearestValue(event.nativeEvent.contentOffset.y);
  };

  return (
    <View style={styles.wheelColumn}>
      <Text style={styles.wheelLabel}>{label}</Text>
      <View style={styles.wheelFrame}>
        <View pointerEvents="none" style={styles.wheelSelection} />
        <View pointerEvents="none" style={styles.wheelTopDivider} />
        <View pointerEvents="none" style={styles.wheelBottomDivider} />
        <ScrollView
          ref={scrollRef}
          style={styles.wheelList}
          scrollEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          nestedScrollEnabled
          contentContainerStyle={styles.wheelContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onScrollEndDrag={handleScrollEndDrag}
          onMomentumScrollBegin={handleMomentumScrollBegin}
          onMomentumScrollEnd={handleMomentumEnd}>
          {options.map((item) => {
            const itemIndex = options.indexOf(item);
            const distance = Math.abs(itemIndex - activeIndex);
            const isSelected = itemIndex === activeIndex;

            return (
              <Pressable
                key={item}
                onPress={() => {
                  setActiveWheelIndex(itemIndex, true);
                  isProgrammaticScrollRef.current = true;
                  scrollRef.current?.scrollTo({
                    animated: true,
                    y: itemIndex * WHEEL_ITEM_HEIGHT,
                  });
                  commitIndex(itemIndex);
                  setTimeout(() => {
                    isProgrammaticScrollRef.current = false;
                  }, 180);
                }}
                style={styles.wheelItem}>
                <Text
                  style={[
                    styles.wheelText,
                    distance === 1 && styles.nearWheelText,
                    distance > 1 && styles.farWheelText,
                    isSelected && styles.selectedWheelText,
                  ]}>
                  {String(item).padStart(2, '0')}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [recentSessions, setRecentSessions] = useState<SessionRecord[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const initialDuration = splitDuration(DEFAULT_DURATION_MINUTES);
  const [selectedHours, setSelectedHours] = useState(initialDuration.hours);
  const [selectedMinutes, setSelectedMinutes] = useState(initialDuration.minutes);
  const durationMinutes = clampDuration(selectedHours * 60 + selectedMinutes);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      Promise.all([getStats(), getSessionHistory()]).then(([stats, history]) => {
        if (isActive) {
          setTotalPoints(stats.totalPoints);
          setCurrentStreak(stats.currentStreak);
          setRecentSessions(history.slice(0, 3));
          setAchievements(calculateAchievements(stats, history));
        }
      });

      return () => {
        isActive = false;
      };
    }, [])
  );

  const sessionPreview = useMemo(() => {
    const rewardPoints = calculateRewardPoints(durationMinutes);

    return {
      durationSeconds: durationMinutes * 60,
      rewardPoints,
      targetTime: formatTargetTime(durationMinutes),
      durationLabel: formatDuration(durationMinutes),
      rewardLabel: `+${rewardPoints} points`,
    };
  }, [durationMinutes]);

  const updateDuration = (nextHours: number, nextMinutes: number) => {
    setSelectedHours(Math.min(12, Math.max(0, nextHours)));
    setSelectedMinutes(Math.min(59, Math.max(0, nextMinutes)));
  };

  const startSession = () => {
    setIsConfirmVisible(false);
    router.push({
      pathname: '/timer',
      params: {
        durationSeconds: String(sessionPreview.durationSeconds),
        rewardPoints: String(sessionPreview.rewardPoints),
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        scrollEnabled
        showsVerticalScrollIndicator={false}
        style={styles.pageList}
        contentContainerStyle={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.logo}>Intent</Text>
              <Text style={styles.subtitle}>Digital detox commitment</Text>
            </View>

            <View style={styles.streakBadge}>
              <Text style={styles.streakValue}>{currentStreak}</Text>
              <Text style={styles.streakLabel}>streak</Text>
            </View>
          </View>

          <View style={styles.hero}>
            <View style={styles.timerRing}>
              <View style={styles.timerCenter}>
                <Text style={styles.timerNumber}>{durationMinutes}</Text>
                <Text style={styles.timerUnit}>min</Text>
              </View>
            </View>

            <Text style={styles.title}>Set a finish time.</Text>
            <Text style={styles.body}>
              Choose when this session ends. Longer commitments earn stronger rewards.
            </Text>
          </View>

          <View style={styles.metrics}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{totalPoints}</Text>
              <Text style={styles.metricLabel}>Total points</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{currentStreak}</Text>
              <Text style={styles.metricLabel}>Current streak</Text>
            </View>
          </View>

          <View style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Recent sessions</Text>
              <Text style={styles.historyCount}>{recentSessions.length}/3</Text>
            </View>

            {recentSessions.length > 0 ? (
              recentSessions.map((session) => (
                <View key={session.id} style={styles.historyRow}>
                  <View>
                    <Text style={styles.historyDuration}>
                      {formatSessionDuration(session.durationSeconds)}
                    </Text>
                    <Text style={styles.historyStatus}>{formatSessionStatus(session.status)}</Text>
                  </View>

                  <Text style={styles.historyPoints}>+{session.pointsEarned} pts</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyStateBox}>
                <Text style={styles.emptyStateTitle}>No sessions yet</Text>
                <Text style={styles.emptyStateBody}>Your completed and ended sessions will appear here.</Text>
              </View>
            )}
          </View>

          <View style={styles.achievementCard}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Achievements</Text>
              <Text style={styles.historyCount}>
                {achievements.filter((achievement) => achievement.isUnlocked).length}/{achievements.length}
              </Text>
            </View>

            {achievements.length > 0 ? (
              <View style={styles.badgeGrid}>
                {achievements.map((achievement) => (
                  <View
                    key={achievement.id}
                    style={[
                      styles.badgeTile,
                      achievement.isUnlocked ? styles.activeBadgeTile : styles.lockedBadgeTile,
                    ]}>
                    <Text
                      style={[
                        styles.badgeTitle,
                        achievement.isUnlocked ? styles.activeBadgeTitle : styles.lockedBadgeTitle,
                      ]}>
                      {achievement.title}
                    </Text>
                    <Text style={styles.badgeDescription}>{achievement.description}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyStateBox}>
                <Text style={styles.emptyStateTitle}>No achievements yet</Text>
                <Text style={styles.emptyStateBody}>Finish a successful detox session to unlock your first badge.</Text>
              </View>
            )}
          </View>

          <View style={styles.targetPanel}>
            <Text style={styles.targetLabel}>Target time</Text>
            <Text style={styles.targetValue}>{sessionPreview.targetTime}</Text>
            <Text style={styles.durationText}>{sessionPreview.durationLabel}</Text>

            <View style={styles.wheelPanel}>
              <WheelPicker
                label="Hours"
                options={HOUR_OPTIONS}
                scrollRef={hourScrollRef}
                selectedValue={selectedHours}
                onChange={(hour) => updateDuration(hour, selectedMinutes)}
              />

              <View style={styles.wheelDivider} />

              <WheelPicker
                label="Min"
                options={MINUTE_OPTIONS}
                scrollRef={minuteScrollRef}
                selectedValue={selectedMinutes}
                onChange={(minute) => updateDuration(selectedHours, minute)}
              />
            </View>

            <View style={styles.rewardCard}>
              <Text style={styles.rewardLabel}>Estimated reward</Text>
              <Text style={styles.rewardValue}>{sessionPreview.rewardLabel}</Text>
            </View>
          </View>

          <Pressable
            onPress={() => setIsConfirmVisible(true)}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
            <Text style={styles.buttonText}>Start detox</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={isConfirmVisible}
        onRequestClose={() => setIsConfirmVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>Ready to begin?</Text>
            <Text style={styles.modalTitle}>Start this detox session</Text>

            <View style={styles.modalSummary}>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Target time</Text>
                <Text style={styles.modalValue}>{sessionPreview.targetTime}</Text>
              </View>

              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Duration</Text>
                <Text style={styles.modalValue}>{sessionPreview.durationLabel}</Text>
              </View>

              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Estimated reward</Text>
                <Text style={styles.modalReward}>{sessionPreview.rewardLabel}</Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setIsConfirmVisible(false)}
                style={({ pressed }) => [styles.modalCancelButton, pressed && styles.buttonPressed]}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={startSession}
                style={({ pressed }) => [styles.modalStartButton, pressed && styles.buttonPressed]}>
                <Text style={styles.modalStartText}>Start session</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pageList: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
  },
  content: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  streakBadge: {
    minWidth: 72,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  streakValue: {
    color: colors.sage,
    fontSize: 24,
    fontWeight: '900',
  },
  streakLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  hero: {
    alignItems: 'center',
    marginTop: 12,
  },
  timerRing: {
    width: 116,
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 58,
    backgroundColor: colors.sageSoft,
  },
  timerCenter: {
    width: 82,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 41,
    backgroundColor: colors.surface,
  },
  timerNumber: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
  },
  timerUnit: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 12,
    color: colors.ink,
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 32,
    textAlign: 'center',
  },
  body: {
    marginTop: 6,
    maxWidth: 310,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  metrics: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.surface,
    padding: 12,
  },
  metricValue: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900',
  },
  metricLabel: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  historyCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.surface,
    marginTop: 12,
    padding: 14,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  historyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  historyCount: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: 16,
    paddingTop: 10,
    marginTop: 10,
  },
  historyDuration: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  historyStatus: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  historyPoints: {
    color: colors.sage,
    fontSize: 15,
    fontWeight: '900',
  },
  emptyStateBox: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 14,
    paddingBottom: 4,
  },
  emptyStateTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyStateBody: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 5,
    textAlign: 'center',
  },
  achievementCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.surface,
    marginTop: 12,
    padding: 14,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  badgeTile: {
    width: '48%',
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  activeBadgeTile: {
    borderColor: colors.sage,
    backgroundColor: colors.sageSoft,
  },
  lockedBadgeTile: {
    borderColor: colors.line,
    backgroundColor: colors.background,
    opacity: 0.72,
  },
  badgeTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  activeBadgeTitle: {
    color: colors.sage,
  },
  lockedBadgeTitle: {
    color: colors.muted,
  },
  badgeDescription: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  targetPanel: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.surface,
    marginTop: 12,
    padding: 14,
  },
  targetLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  targetValue: {
    marginTop: 4,
    color: colors.ink,
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
  },
  durationText: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  wheelPanel: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.background,
    marginTop: 10,
    padding: 8,
  },
  wheelColumn: {
    flex: 1,
    alignItems: 'center',
  },
  wheelLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  wheelFrame: {
    height: WHEEL_PICKER_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
    width: 104,
  },
  wheelContent: {
    paddingTop: WHEEL_CENTER_OFFSET,
    paddingBottom: WHEEL_CENTER_OFFSET,
  },
  wheelList: {
    zIndex: 1,
  },
  wheelItem: {
    alignItems: 'center',
    height: WHEEL_ITEM_HEIGHT,
    justifyContent: 'center',
    width: 104,
  },
  wheelSelection: {
    position: 'absolute',
    top: WHEEL_CENTER_OFFSET,
    left: 4,
    right: 4,
    height: WHEEL_ITEM_HEIGHT,
    borderRadius: 999,
    backgroundColor: colors.surface,
    zIndex: 0,
  },
  wheelTopDivider: {
    position: 'absolute',
    top: WHEEL_CENTER_OFFSET,
    left: 10,
    right: 10,
    height: 1,
    backgroundColor: colors.sage,
    opacity: 0.55,
    zIndex: 2,
  },
  wheelBottomDivider: {
    position: 'absolute',
    top: WHEEL_CENTER_OFFSET + WHEEL_ITEM_HEIGHT,
    left: 10,
    right: 10,
    height: 1,
    backgroundColor: colors.sage,
    opacity: 0.55,
    zIndex: 2,
  },
  wheelText: {
    color: colors.muted,
    fontSize: 22,
    fontWeight: '800',
    opacity: 0.55,
  },
  nearWheelText: {
    opacity: 0.75,
  },
  farWheelText: {
    opacity: 0.28,
  },
  selectedWheelText: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '900',
    opacity: 1,
  },
  wheelDivider: {
    width: 1,
    backgroundColor: colors.line,
    marginHorizontal: 12,
  },
  rewardCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.sageSoft,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  rewardLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  rewardValue: {
    marginTop: 4,
    color: colors.sage,
    fontSize: 20,
    fontWeight: '900',
  },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.sage,
    marginTop: 12,
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  buttonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(31, 39, 35, 0.42)',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
    backgroundColor: colors.surface,
    padding: 22,
  },
  modalEyebrow: {
    color: colors.sage,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  modalTitle: {
    marginTop: 8,
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
    textAlign: 'center',
  },
  modalSummary: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.background,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 16,
    paddingVertical: 14,
  },
  modalLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  modalValue: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  modalReward: {
    flexShrink: 1,
    color: colors.sage,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  modalCancelButton: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  modalStartButton: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.sage,
  },
  modalCancelText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '900',
  },
  modalStartText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '900',
  },
});
