import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  Animated,
  Easing,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { calculateRewardPoints } from '../../services/storage';
import { CeramicButton } from '../intent/CeramicButton';
import { formatDuration, formatTargetTime } from '../intent/format';
import { HardwareLed } from '../intent/HardwareLed';
import { colors, radius, shadows, spacing, typography } from '../../constants/theme';

const MIN_DURATION_MINUTES = 5;
const MAX_DURATION_MINUTES = 12 * 60;
const DEFAULT_DURATION_MINUTES = 30;
const HOUR_OPTIONS = Array.from({ length: 13 }, (_, index) => index);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => index);
const WHEEL_ITEM_HEIGHT = 48;
const WHEEL_VISIBLE_ITEMS = 5;
const WHEEL_PICKER_HEIGHT = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ITEMS;
const WHEEL_CENTER_OFFSET = (WHEEL_PICKER_HEIGHT - WHEEL_ITEM_HEIGHT) / 2;
const NOTE_RADIUS = 22;
const NOTE_GAP_INSET = 4;
const NOTE_INNER_INSET = 6;
const NOTE_GAP_RADIUS = NOTE_RADIUS - 2;
const NOTE_INNER_RADIUS = NOTE_RADIUS - 4;
const WHEEL_FIELD_WIDTH = 108;
const WHEEL_RADIUS = 24;
const WHEEL_GAP_INSET = 4;
const WHEEL_INNER_INSET = 6;
const WHEEL_GAP_RADIUS = WHEEL_RADIUS - 2;
const WHEEL_INNER_RADIUS = WHEEL_RADIUS - 4;
const WHEEL_SLOT_WIDTH = WHEEL_FIELD_WIDTH + WHEEL_INNER_INSET * 2;
const WHEEL_SLOT_HEIGHT = WHEEL_PICKER_HEIGHT + WHEEL_INNER_INSET * 2;
const WHEEL_SELECTED_RADIUS = 14;
const REWARD_COUNTER_DIGITS = 5;
const REWARD_COUNTER_MAX = 99999;
const REWARD_DIGIT_HEIGHT = 30;
const PURPOSE_CHIPS = ['Study', 'Work', 'Reading', 'Sleep'];

function clampDuration(minutes: number) {
  return Math.min(MAX_DURATION_MINUTES, Math.max(MIN_DURATION_MINUTES, minutes));
}

function splitDuration(durationMinutes: number) {
  return {
    hours: Math.floor(durationMinutes / 60),
    minutes: durationMinutes % 60,
  };
}

function formatRewardCounter(rewardPoints: number) {
  return String(Math.min(REWARD_COUNTER_MAX, Math.max(0, Math.floor(rewardPoints)))).padStart(
    REWARD_COUNTER_DIGITS,
    '0'
  );
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
      return;
    }

    if (selectedIndex !== activeIndexRef.current) {
      activeIndexRef.current = selectedIndex;
      setActiveIndex(selectedIndex);
      isProgrammaticScrollRef.current = true;
      scrollRef.current?.scrollTo({
        animated: true,
        y: selectedIndex * WHEEL_ITEM_HEIGHT,
      });
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 180);
    }
  }, [scrollRef, selectedIndex]);

  useEffect(() => clearEndDragTimer, []);

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

    if (typeof nextValue === 'number' && nextValue !== selectedValue) {
      onChange(nextValue);
    }
  };

  const settleToNearestValue = (scrollOffset: number) => {
    const nextIndex = getIndexFromScrollOffset(scrollOffset);

    isProgrammaticScrollRef.current = true;
    scrollRef.current?.scrollTo({
      animated: true,
      y: nextIndex * WHEEL_ITEM_HEIGHT,
    });
    setActiveWheelIndex(nextIndex, false);
    commitIndex(nextIndex);

    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 180);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActiveWheelIndex(
      getIndexFromScrollOffset(event.nativeEvent.contentOffset.y),
      !isProgrammaticScrollRef.current
    );
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
        <LinearGradient
          pointerEvents="none"
          colors={['#DEDAD0', '#F6F3EC']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.wheelFrameGradient}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(52,47,39,0.14)', 'rgba(52,47,39,0.075)', 'rgba(52,47,39,0.024)']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.wheelContactGap}
        />
        <View pointerEvents="none" style={styles.wheelCavityShadow} />
        <View style={styles.wheelField}>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(17,19,18,0.095)', 'rgba(17,19,18,0.032)', 'rgba(17,19,18,0)']}
            locations={[0, 0.42, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.wheelTopShade}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(52,47,39,0)', 'rgba(52,47,39,0.04)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.wheelBottomDepth}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.2)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.wheelBottomHighlight}
          />
          <View pointerEvents="none" style={styles.wheelSelection}>
            <LinearGradient
              pointerEvents="none"
              colors={[
                'rgba(255,255,255,0.94)',
                'rgba(252,250,246,0.86)',
                'rgba(242,238,231,0.54)',
              ]}
              locations={[0, 0.5, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.wheelSelectionGradient}
            />
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(255,255,255,0.78)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
              locations={[0, 0.35, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.wheelSelectionGlassSheen}
            />
            <View pointerEvents="none" style={styles.wheelSelectionTopGlint} />
            <LinearGradient
              pointerEvents="none"
              colors={[
                'rgba(52,47,39,0)',
                'rgba(52,47,39,0.045)',
                'rgba(52,47,39,0.075)',
              ]}
              locations={[0, 0.58, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.wheelSelectionLowerDepth}
            />
            <View pointerEvents="none" style={styles.wheelSelectionBottomGlint} />
            <View pointerEvents="none" style={styles.wheelSelectionBevel} />
          </View>

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
            {options.map((item, itemIndex) => {
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
    </View>
  );
}

type RewardDigitProps = {
  targetDigit: string;
};

function RewardDigit({ targetDigit }: RewardDigitProps) {
  const transitionProgress = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<ReturnType<typeof Animated.timing> | null>(null);
  const animationRunRef = useRef(0);
  const progressValueRef = useRef(0);
  const currentDigitRef = useRef(targetDigit);
  const nextDigitRef = useRef(targetDigit);
  const [currentDigit, setCurrentDigit] = useState(targetDigit);
  const [nextDigit, setNextDigit] = useState(targetDigit);

  useEffect(() => {
    const listenerId = transitionProgress.addListener(({ value }) => {
      progressValueRef.current = value;
    });

    return () => {
      animationRunRef.current += 1;
      animationRef.current?.stop();
      transitionProgress.removeListener(listenerId);
    };
  }, [transitionProgress]);

  useEffect(() => {
    if (targetDigit === nextDigitRef.current) {
      return;
    }

    animationRunRef.current += 1;
    animationRef.current?.stop();

    const visibleDigit = progressValueRef.current >= 0.5 ? nextDigitRef.current : currentDigitRef.current;

    currentDigitRef.current = visibleDigit;
    nextDigitRef.current = targetDigit;
    setCurrentDigit(visibleDigit);
    setNextDigit(targetDigit);
    transitionProgress.setValue(0);
    progressValueRef.current = 0;

    const animationRunId = animationRunRef.current;
    const animation = Animated.timing(transitionProgress, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animationRef.current = animation;
    animation.start(({ finished }) => {
      if (!finished || animationRunId !== animationRunRef.current) {
        return;
      }

      currentDigitRef.current = targetDigit;
      nextDigitRef.current = targetDigit;
      setCurrentDigit(targetDigit);
      setNextDigit(targetDigit);
      transitionProgress.setValue(0);
      progressValueRef.current = 0;
    });
  }, [targetDigit, transitionProgress]);

  const currentTranslateY = transitionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });
  const currentOpacity = transitionProgress.interpolate({
    inputRange: [0, 0.82, 1],
    outputRange: [1, 0.08, 0],
  });
  const nextTranslateY = transitionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });
  const nextOpacity = transitionProgress.interpolate({
    inputRange: [0, 0.18, 1],
    outputRange: [0, 0.18, 1],
  });

  return (
    <LinearGradient
      colors={['#DEDAD0', '#F6F3EC']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.rewardDigitShell}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(52,47,39,0.14)', 'rgba(52,47,39,0.075)', 'rgba(52,47,39,0.024)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.rewardDigitContactGap}
      />
      <View pointerEvents="none" style={styles.rewardDigitCavityShadow} />
      <View style={styles.rewardDigitField}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.94)', 'rgba(252,250,246,0.84)', 'rgba(242,238,231,0.5)']}
          locations={[0, 0.52, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.rewardDigitGlass}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.72)', 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0)']}
          locations={[0, 0.38, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.rewardDigitSheen}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(52,47,39,0)', 'rgba(52,47,39,0.065)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.rewardDigitLowerDepth}
        />
        <View pointerEvents="none" style={styles.rewardDigitBottomGlint} />
        <Animated.Text
          style={[
            styles.rewardDigitText,
            {
              opacity: currentOpacity,
              transform: [{ translateY: currentTranslateY }],
            },
          ]}>
          {currentDigit}
        </Animated.Text>
        <Animated.Text
          style={[
            styles.rewardDigitText,
            {
              opacity: nextOpacity,
              transform: [{ translateY: nextTranslateY }],
            },
          ]}>
          {nextDigit}
        </Animated.Text>
      </View>
    </LinearGradient>
  );
}

type RewardCounterProps = {
  rewardPoints: number;
};

function RewardCounter({ rewardPoints }: RewardCounterProps) {
  const targetDigits = useMemo(() => formatRewardCounter(rewardPoints).split(''), [rewardPoints]);

  return (
    <View style={styles.rewardCounter}>
      <View style={styles.rewardCounterRow}>
        {targetDigits.map((digit, index) => (
          <RewardDigit key={index} targetDigit={digit} />
        ))}
      </View>
      <Text style={styles.rewardCounterLabel}>POINTS</Text>
    </View>
  );
}

export default function SessionScreen() {
  const router = useRouter();
  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);
  const initialDuration = splitDuration(DEFAULT_DURATION_MINUTES);
  const [selectedHours, setSelectedHours] = useState(initialDuration.hours);
  const [selectedMinutes, setSelectedMinutes] = useState(initialDuration.minutes);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [sessionNote, setSessionNote] = useState('');
  const [selectedPurpose, setSelectedPurpose] = useState<string | undefined>();
  const durationMinutes = clampDuration(selectedHours * 60 + selectedMinutes);

  const sessionPreview = useMemo(() => {
    const rewardPoints = calculateRewardPoints(durationMinutes);

    return {
      durationSeconds: durationMinutes * 60,
      rewardPoints,
      targetTime: formatTargetTime(durationMinutes).replace(/^Tomorrow,\s*/, ''),
      durationLabel: formatDuration(durationMinutes),
      rewardLabel: `+${rewardPoints} points`,
    };
  }, [durationMinutes]);

  const updateDuration = (nextHours: number, nextMinutes: number) => {
    const clampedMinutes = clampDuration(
      Math.min(12, Math.max(0, nextHours)) * 60 + Math.min(59, Math.max(0, nextMinutes))
    );
    const nextDuration = splitDuration(clampedMinutes);

    setSelectedHours(nextDuration.hours);
    setSelectedMinutes(nextDuration.minutes);
  };

  const togglePurposeChip = (purpose: string) => {
    setSelectedPurpose((currentPurpose) => (currentPurpose === purpose ? undefined : purpose));
  };

  const startSession = () => {
    const trimmedNote = sessionNote.trim();
    const sessionId = Date.now() + '-' + Math.random().toString(36).slice(2, 8);

    setIsConfirmVisible(false);
    router.push({
      pathname: '/timer',
      params: {
        sessionId,
        durationSeconds: String(sessionPreview.durationSeconds),
        rewardPoints: String(sessionPreview.rewardPoints),
        ...(selectedPurpose ? { purpose: selectedPurpose } : {}),
        ...(trimmedNote ? { note: trimmedNote } : {}),
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        style={styles.pageList}
        contentContainerStyle={styles.container}>
        <View style={styles.targetPanel}>
          <View style={styles.timerZone}>
            <View style={styles.targetReadout}>
              <Text style={styles.targetLabel}>Target time</Text>
              <Text style={styles.targetValue}>{sessionPreview.targetTime}</Text>
            </View>

            <View style={styles.wheelPanel}>
              <WheelPicker
                label="HOURS"
                options={HOUR_OPTIONS}
                scrollRef={hourScrollRef}
                selectedValue={selectedHours}
                onChange={(hour) => updateDuration(hour, selectedMinutes)}
              />

              <Text style={styles.wheelSeparator}>:</Text>

              <WheelPicker
                label="MIN"
                options={MINUTE_OPTIONS}
                scrollRef={minuteScrollRef}
                selectedValue={selectedMinutes}
                onChange={(minute) => updateDuration(selectedHours, minute)}
              />
            </View>
          </View>

          <View style={styles.formZone}>
            <View style={styles.purposeSection}>
              <Text style={styles.purposeLabel}>Purpose</Text>
              <View style={styles.purposeCluster}>
                <View style={styles.purposeChipRow}>
                  {PURPOSE_CHIPS.map((purpose) => {
                    const isSelected = selectedPurpose === purpose;

                    return (
                      <CeramicButton
                        key={purpose}
                        size="small"
                        onPress={() => togglePurposeChip(purpose)}
                        surfaceStyle={[styles.purposeChipSurface, isSelected && styles.selectedPurposeChipSurface]}>
                        <HardwareLed isOn={isSelected} size="small" />
                        <Text style={[styles.purposeChipText, isSelected && styles.selectedPurposeChipText]}>
                          #{purpose}
                        </Text>
                      </CeramicButton>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={styles.noteSection}>
              <Text style={styles.noteLabel}>Note</Text>
              <LinearGradient
                colors={['#DEDAD0', '#F6F3EC']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.noteSeat}>
                <LinearGradient
                  pointerEvents="none"
                  colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.58)']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.noteShellBottomBevel}
                />
                <LinearGradient
                  pointerEvents="none"
                  colors={['rgba(52,47,39,0.14)', 'rgba(52,47,39,0.075)', 'rgba(52,47,39,0.024)']}
                  locations={[0, 0.5, 1]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.noteContactGap}
                />
                <View pointerEvents="none" style={styles.noteCavityShadow} />
                <View style={styles.noteField}>
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(17,19,18,0.095)', 'rgba(17,19,18,0.032)', 'rgba(17,19,18,0)']}
                    locations={[0, 0.42, 1]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.noteTopShade}
                  />
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(52,47,39,0)', 'rgba(52,47,39,0.04)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.noteBottomDepth}
                  />
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.2)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.noteBottomHighlight}
                  />
                  <TextInput
                    multiline
                    placeholder="Add a note (optional)"
                    placeholderTextColor="rgba(102,107,103,0.62)"
                    value={sessionNote}
                    onChangeText={setSessionNote}
                    style={styles.noteInput}
                    textAlignVertical="top"
                  />
                </View>
              </LinearGradient>
            </View>
          </View>

          <View style={styles.actionZone}>
            <View style={styles.rewardCard}>
              <Text style={styles.rewardLabel}>Estimated reward</Text>
              <RewardCounter rewardPoints={sessionPreview.rewardPoints} />
            </View>

            <CeramicButton size="largeCompact" onPress={() => setIsConfirmVisible(true)}>
              <HardwareLed size="medium" />
              <Text style={styles.buttonText}>Start detox</Text>
            </CeramicButton>
          </View>
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
              {selectedPurpose ? (
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Purpose</Text>
                  <Text style={styles.modalValue}>#{selectedPurpose}</Text>
                </View>
              ) : null}
              {sessionNote.trim() ? (
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Note</Text>
                  <Text style={styles.modalValue}>{sessionNote.trim()}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.modalActions}>
              <CeramicButton size="medium" onPress={() => setIsConfirmVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </CeramicButton>
              <CeramicButton size="medium" onPress={startSession}>
                <HardwareLed size="small" />
                <Text style={styles.modalStartText}>Start session</Text>
              </CeramicButton>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  targetPanel: {
    flex: 1,
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  timerZone: {
    flex: 5,
    justifyContent: 'flex-end',
    gap: spacing.sm,
    minHeight: 350,
  },
  formZone: {
    flex: 0,
    justifyContent: 'flex-start',
    gap: spacing.md,
  },
  actionZone: {
    flex: 0,
    justifyContent: 'flex-start',
    gap: spacing.sm,
  },
  header: {
    borderBottomWidth: 0,
    borderBottomColor: colors.line,
    paddingBottom: spacing.md,
  },
  panelEyebrow: {
    ...typography.panelLabel,
    color: colors.muted,
  },
  logo: {
    ...typography.screenTitle,
    color: colors.ink,
    marginTop: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.muted,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  targetReadout: {
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: spacing.sm,
  },
  targetLabel: {
    ...typography.panelLabel,
    color: colors.muted,
    textAlign: 'center',
  },
  targetValue: {
    ...typography.valueLarge,
    marginTop: 2,
    color: colors.ink,
    fontSize: 36,
    lineHeight: 40,
    textAlign: 'center',
    letterSpacing: 0,
  },
  wheelPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 0,
  },
  wheelColumn: {
    alignItems: 'center',
  },
  wheelLabel: {
    ...typography.instrumentLabel,
    color: colors.muted,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  wheelFrame: {
    height: WHEEL_SLOT_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
    width: WHEEL_SLOT_WIDTH,
    borderWidth: 0,
    borderRadius: WHEEL_RADIUS,
    backgroundColor: colors.surface,
  },
  wheelFrameGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: WHEEL_RADIUS,
  },
  wheelContactGap: {
    position: 'absolute',
    top: WHEEL_GAP_INSET,
    right: WHEEL_GAP_INSET,
    bottom: WHEEL_GAP_INSET,
    left: WHEEL_GAP_INSET,
    borderRadius: WHEEL_GAP_RADIUS,
  },
  wheelCavityShadow: {
    position: 'absolute',
    top: WHEEL_GAP_INSET + 1,
    right: WHEEL_GAP_INSET + 1,
    bottom: WHEEL_GAP_INSET + 1,
    left: WHEEL_GAP_INSET + 1,
    borderRadius: WHEEL_GAP_RADIUS - 1,
    backgroundColor: 'rgba(17,19,18,0.018)',
    shadowColor: '#111312',
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 1, height: 2 },
    elevation: 1,
  },
  wheelField: {
    position: 'absolute',
    top: WHEEL_INNER_INSET,
    right: WHEEL_INNER_INSET,
    bottom: WHEEL_INNER_INSET,
    left: WHEEL_INNER_INSET,
    overflow: 'hidden',
    borderWidth: 0,
    borderRadius: WHEEL_INNER_RADIUS,
    backgroundColor: '#E4E0D8',
  },
  wheelTopShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: 28,
  },
  wheelBottomHighlight: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    height: 14,
  },
  wheelBottomDepth: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    height: 18,
  },
  wheelContent: {
    paddingTop: WHEEL_CENTER_OFFSET,
    paddingBottom: WHEEL_CENTER_OFFSET,
  },
  wheelList: {
    zIndex: 2,
  },
  wheelItem: {
    alignItems: 'center',
    height: WHEEL_ITEM_HEIGHT,
    justifyContent: 'center',
    width: WHEEL_FIELD_WIDTH,
  },
  wheelSelection: {
    position: 'absolute',
    top: WHEEL_CENTER_OFFSET,
    left: 8,
    right: 8,
    height: WHEEL_ITEM_HEIGHT,
    overflow: 'hidden',
    borderWidth: 0,
    borderRadius: WHEEL_SELECTED_RADIUS,
    backgroundColor: 'rgba(246,243,236,0.76)',
    zIndex: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.075,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
  },
  wheelSelectionGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: WHEEL_SELECTED_RADIUS,
  },
  wheelSelectionGlassSheen: {
    position: 'absolute',
    top: 1,
    right: 3,
    left: 3,
    height: 20,
    borderTopLeftRadius: WHEEL_SELECTED_RADIUS - 2,
    borderTopRightRadius: WHEEL_SELECTED_RADIUS - 2,
  },
  wheelSelectionTopGlint: {
    position: 'absolute',
    top: 2,
    right: 12,
    left: 12,
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
  wheelSelectionLowerDepth: {
    position: 'absolute',
    right: 2,
    bottom: 0,
    left: 2,
    height: 19,
    borderBottomLeftRadius: WHEEL_SELECTED_RADIUS - 1,
    borderBottomRightRadius: WHEEL_SELECTED_RADIUS - 1,
  },
  wheelSelectionBottomGlint: {
    position: 'absolute',
    right: 10,
    bottom: 1,
    left: 10,
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.74)',
    opacity: 0.84,
  },
  wheelSelectionBevel: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderTopColor: 'rgba(255,255,255,0.68)',
    borderLeftColor: 'rgba(255,255,255,0.34)',
    borderRadius: WHEEL_SELECTED_RADIUS,
  },
  wheelText: {
    fontFamily: typography.meta.fontFamily,
    color: colors.muted,
    fontSize: 20,
    opacity: 0.48,
  },
  nearWheelText: {
    opacity: 0.7,
  },
  farWheelText: {
    opacity: 0.22,
  },
  selectedWheelText: {
    fontFamily: typography.meta.fontFamily,
    color: colors.ink,
    fontSize: 34,
    opacity: 1,
    transform: [{ translateY: -2 }],
  },
  wheelSeparator: {
    fontFamily: typography.meta.fontFamily,
    alignSelf: 'center',
    color: 'rgba(17,19,18,0.58)',
    fontSize: 38,
    lineHeight: 42,
    marginTop: spacing.lg,
  },
  purposeSection: {
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.xs,
  },
  purposeCluster: {
    alignSelf: 'center',
    maxWidth: '100%',
  },
  purposeLabel: {
    ...typography.panelLabel,
    alignSelf: 'flex-start',
    color: colors.muted,
  },
  purposeChipScroller: {
    alignSelf: 'center',
    flexGrow: 0,
    maxWidth: '100%',
  },
  purposeChipRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  purposeChipSurface: {
    gap: 2,
    paddingLeft: 3,
    paddingRight: 7,
  },
  purposeChipBase: {
    borderRadius: radius.pill,
    backgroundColor: 'rgba(213,209,200,0.48)',
    padding: 3,
    borderWidth: 0,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  purposeSeatGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.pill,
  },
  purposeChipContactGap: {
    ...StyleSheet.absoluteFillObject,
    left: 2,
    right: 2,
    top: 2,
    bottom: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(34,31,26,0.035)',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  purposeChipGapShade: {
    position: 'absolute',
    right: 8,
    bottom: 1,
    left: 8,
    height: 9,
    borderBottomLeftRadius: radius.pill,
    borderBottomRightRadius: radius.pill,
    backgroundColor: 'rgba(42,38,31,0.06)',
  },
  purposeChip: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 0,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
    shadowColor: '#000000',
    shadowOpacity: 0.11,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  purposeEdgeHighlight: {
    position: 'absolute',
    left: 8,
    top: 2,
    right: 8,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  purposeEdgeShade: {
    position: 'absolute',
    right: 10,
    bottom: 1,
    left: 10,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(31,28,24,0.045)',
  },
  purposeChipPressed: {
    opacity: 0.9,
    transform: [{ translateY: 2 }, { scale: 0.985 }],
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    backgroundColor: colors.surfaceInset,
  },
  purposeChipText: {
    ...typography.chip,
    color: colors.muted,
    fontSize: 9,
    lineHeight: 12,
  },
  selectedPurposeChipSurface: {},
  selectedPurposeChip: {
    borderTopColor: 'rgba(255,255,255,0.35)',
    borderLeftColor: colors.line,
    borderRightColor: colors.line,
    borderBottomColor: 'rgba(17,19,18,0.16)',
    backgroundColor: 'rgba(47,48,46,0.12)',
    shadowOpacity: 0.04,
    elevation: 1,
  },
  selectedPurposeChipText: {
    color: colors.ink,
  },
  noteSection: {
    gap: 5,
  },
  noteSeat: {
    width: '100%',
    height: 100,
    borderWidth: 0,
    overflow: 'hidden',
    borderRadius: NOTE_RADIUS,
    padding: NOTE_INNER_INSET,
    position: 'relative',
  },
  noteContactGap: {
    position: 'absolute',
    top: NOTE_GAP_INSET,
    right: NOTE_GAP_INSET,
    bottom: NOTE_GAP_INSET,
    left: NOTE_GAP_INSET,
    borderRadius: NOTE_GAP_RADIUS,
  },
  noteShellBottomBevel: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    height: 24,
    borderBottomLeftRadius: NOTE_RADIUS,
    borderBottomRightRadius: NOTE_RADIUS,
  },
  noteCavityShadow: {
    position: 'absolute',
    top: NOTE_GAP_INSET + 1,
    right: NOTE_GAP_INSET + 1,
    bottom: NOTE_GAP_INSET + 1,
    left: NOTE_GAP_INSET + 1,
    borderRadius: NOTE_GAP_RADIUS - 1,
    backgroundColor: 'rgba(17,19,18,0.018)',
    shadowColor: '#111312',
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 1, height: 2 },
    elevation: 1,
  },
  noteField: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 0,
    borderRadius: NOTE_INNER_RADIUS,
    backgroundColor: '#E4E0D8',
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: 'relative',
    zIndex: 1,
  },
  noteTopShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
  },
  noteBottomHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 14,
  },
  noteBottomDepth: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 18,
  },
  noteLabel: {
    ...typography.panelLabel,
    color: colors.muted,
  },
  noteInput: {
    ...typography.body,
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
    paddingHorizontal: 0,
    paddingVertical: 0,
    zIndex: 1,
  },
  rewardCard: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  rewardLabel: {
    ...typography.panelLabel,
    color: colors.muted,
  },
  rewardCounter: {
    alignItems: 'center',
    marginTop: 5,
    gap: 4,
  },
  rewardCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rewardDigitShell: {
    width: 30,
    height: 40,
    overflow: 'hidden',
    borderRadius: 13,
    padding: 4,
    position: 'relative',
  },
  rewardDigitContactGap: {
    position: 'absolute',
    top: 3,
    right: 3,
    bottom: 3,
    left: 3,
    borderRadius: 11,
  },
  rewardDigitCavityShadow: {
    position: 'absolute',
    top: 4,
    right: 4,
    bottom: 4,
    left: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(17,19,18,0.018)',
    shadowColor: '#111312',
    shadowOpacity: 0.14,
    shadowRadius: 3,
    shadowOffset: { width: 1, height: 2 },
    elevation: 1,
  },
  rewardDigitField: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 9,
    backgroundColor: '#E4E0D8',
    position: 'relative',
  },
  rewardDigitGlass: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 9,
  },
  rewardDigitSheen: {
    position: 'absolute',
    top: 1,
    right: 2,
    left: 2,
    height: 13,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  rewardDigitLowerDepth: {
    position: 'absolute',
    right: 1,
    bottom: 0,
    left: 1,
    height: 12,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  rewardDigitBottomGlint: {
    position: 'absolute',
    right: 6,
    bottom: 1,
    left: 6,
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.66)',
    opacity: 0.72,
  },
  rewardDigitText: {
    position: 'absolute',
    top: 1,
    right: 0,
    left: 0,
    fontFamily: typography.meta.fontFamily,
    height: REWARD_DIGIT_HEIGHT,
    color: colors.ink,
    fontSize: 20,
    lineHeight: REWARD_DIGIT_HEIGHT,
    textAlign: 'center',
  },
  rewardCounterLabel: {
    ...typography.instrumentLabel,
    color: colors.muted,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.8,
  },
  rewardValue: {
    fontFamily: typography.valueLarge.fontFamily,
    marginTop: 4,
    color: colors.sage,
    fontSize: 23,
    lineHeight: 28,
  },
  buttonBase: {
    marginTop: 2,
    borderRadius: 28,
    backgroundColor: 'rgba(209,205,196,0.58)',
    padding: 6,
    borderWidth: 0,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.11,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  buttonSeatGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
  },
  buttonContactGap: {
    ...StyleSheet.absoluteFillObject,
    left: 4,
    right: 4,
    top: 4,
    bottom: 4,
    borderRadius: 24,
    backgroundColor: 'rgba(31,28,24,0.035)',
    shadowColor: '#000000',
    shadowOpacity: 0.13,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  buttonGapShade: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 4,
    height: 13,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    backgroundColor: 'rgba(34,30,24,0.075)',
  },
  button: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 0,
    borderRadius: 22,
    backgroundColor: colors.surface,
    gap: spacing.xs,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  buttonEdgeHighlight: {
    position: 'absolute',
    left: 10,
    top: 4,
    right: 10,
    height: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  buttonEdgeShade: {
    position: 'absolute',
    right: 14,
    bottom: 3,
    left: 14,
    height: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(31,28,24,0.055)',
  },
  controlGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 21,
  },
  innerBevel: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 0,
    borderRadius: 21,
    backgroundColor: 'transparent',
    shadowColor: '#F0EEE9',
    shadowOpacity: 0.16,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: -1 },
  },
  buttonText: {
    ...typography.button,
    color: colors.ink,
    fontSize: 16,
  },
  buttonPressed: {
    opacity: 0.94,
    transform: [{ translateY: 2 }, { scale: 0.985 }],
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17, 19, 18, 0.42)',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderWidth: 0,
    borderColor: colors.line,
    borderRadius: radius.card,
    backgroundColor: colors.panel,
    padding: spacing.xl,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  modalEyebrow: {
    ...typography.panelLabel,
    color: colors.sage,
    textAlign: 'center',
  },
  modalTitle: {
    fontFamily: typography.screenTitle.fontFamily,
    marginTop: spacing.sm,
    color: colors.ink,
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
  },
  modalSummary: {
    borderWidth: 0,
    borderColor: colors.line,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceInset,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 0,
    borderBottomColor: colors.line,
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalLabel: {
    ...typography.meta,
    color: colors.muted,
    fontSize: 13,
  },
  modalValue: {
    fontFamily: typography.cardTitle.fontFamily,
    flexShrink: 1,
    color: colors.ink,
    fontSize: 13,
    textAlign: 'right',
  },
  modalReward: {
    fontFamily: typography.cardTitle.fontFamily,
    flexShrink: 1,
    color: colors.sage,
    fontSize: 13,
    textAlign: 'right',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  modalCancelButton: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: colors.line,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    ...shadows.raisedControl,
  },
  modalStartButton: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 0,

    borderRadius: radius.button,
    backgroundColor: colors.surface,
    gap: spacing.xs,
    shadowColor: '#000000',
    shadowOpacity: 0.13,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  modalCancelText: {
    ...typography.button,
    color: colors.muted,
    fontSize: 13,
  },
  modalStartText: {
    ...typography.button,
    color: colors.ink,
    fontSize: 13,
  },
});







