import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { calculateRewardPoints } from '../../services/storage';
import { AnchorRulesModal } from '../intent/AnchorRulesModal';
import { CeramicButton } from '../intent/CeramicButton';
import { ConfirmModal } from '../intent/ConfirmModal';
import { formatDuration, formatTargetTime } from '../intent/format';
import { HardwareLed } from '../intent/HardwareLed';
import { InfoButton } from '../intent/InfoButton';
import {
  OPTICAL_LABEL_INSET,
  OPTICAL_ROUNDED_OUTSET,
  SCREEN_HORIZONTAL_PADDING,
  colors,
  spacing,
  typography,
} from '../../constants/theme';

const MIN_DURATION_MINUTES = 5;
const MAX_DURATION_MINUTES = 12 * 60;
const DEFAULT_DURATION_MINUTES = 30;
const HOUR_OPTIONS = Array.from({ length: 13 }, (_, index) => index);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => index);
const LOCKED_MAX_MINUTE_OPTIONS = [0];
const WHEEL_ITEM_HEIGHT = 48;
const WHEEL_VISIBLE_ITEMS = 5;
const WHEEL_PICKER_HEIGHT = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ITEMS;
const WHEEL_CENTER_OFFSET = (WHEEL_PICKER_HEIGHT - WHEEL_ITEM_HEIGHT) / 2;
const NOTE_RADIUS = 22;
const NOTE_GAP_INSET = 4;
const NOTE_GAP_RADIUS = NOTE_RADIUS - 2;
const NOTE_INNER_INSET = 6;
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
const TIMER_SETTINGS_TOP_PADDING = 14;
const TIMER_SETTINGS_FORM_GAP = 10;
const TIMER_SETTINGS_ACTION_GAP = 6;
const TIMER_SETTINGS_NOTE_HEIGHT = 94;
const TIMER_SETTINGS_COMPACT_NOTE_HEIGHT = 66;
const TIMER_SETTINGS_ACTION_TO_NAV_GAP = 42;
const TIMER_SETTINGS_COMPACT_ACTION_TO_NAV_GAP = 30;
const PURPOSE_CHIPS = ['Study', 'Work', 'Reading', 'Creative'];

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
  const latestScrollOffsetRef = useRef(selectedIndex * WHEEL_ITEM_HEIGHT);
  const isMomentumActiveRef = useRef(false);

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

    if (selectedIndex !== activeIndexRef.current && !isProgrammaticScrollRef.current) {
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
    setActiveWheelIndex(nextIndex, false);
    commitIndex(nextIndex);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    latestScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
    if (!isProgrammaticScrollRef.current) {
      setActiveWheelIndex(
        getIndexFromScrollOffset(event.nativeEvent.contentOffset.y),
        true
      );
    }
  };

  const handleScrollEndDrag = (_event: NativeSyntheticEvent<NativeScrollEvent>) => {
    clearEndDragTimer();
    endDragTimerRef.current = setTimeout(() => {
      if (!isMomentumActiveRef.current) {
        settleToNearestValue(latestScrollOffsetRef.current);
      }
    }, 120);
  };

  const handleMomentumScrollBegin = () => {
    isMomentumActiveRef.current = true;
    clearEndDragTimer();
  };

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    isMomentumActiveRef.current = false;
    clearEndDragTimer();
    settleToNearestValue(event.nativeEvent.contentOffset.y);
  };

  return (
    <View style={styles.wheelColumn}>
      <Text style={styles.wheelLabel}>{label}</Text>
      <View style={styles.wheelFrame}>
        <LinearGradient
          pointerEvents="none"
          colors={['#DEDAD0', '#FDFAF5']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.wheelFrameGradient}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(52,47,39,0.22)', 'rgba(52,47,39,0.11)', 'rgba(52,47,39,0.036)']}
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
            snapToInterval={WHEEL_ITEM_HEIGHT}
            snapToAlignment="start"
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
                    if (itemIndex !== activeIndexRef.current) {
                      void playSelectionHaptic();
                    }
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
                  {isSelected ? (
                    <View style={styles.wheelEngravedWrap}>
                      <Text style={[styles.wheelText, styles.selectedWheelText, styles.selectedWheelHighlight]} importantForAccessibility="no">
                        {String(item).padStart(2, '0')}
                      </Text>
                      <Text style={[styles.wheelText, styles.selectedWheelText, styles.selectedWheelEngraved]}>
                        {String(item).padStart(2, '0')}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.wheelText, distance === 1 && styles.nearWheelText, distance > 1 && styles.farWheelText]}>
                      {String(item).padStart(2, '0')}
                    </Text>
                  )}
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
  staggerDelay: number;
};

const DIGIT_BASE_DURATION = 140;

function RewardDigit({ targetDigit, staggerDelay }: RewardDigitProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const runIdRef = useRef(0);
  const progressRef = useRef(0);
  const shouldStartAnim = useRef(false);
  const pendingDuration = useRef(DIGIT_BASE_DURATION);
  const [from, setFrom] = useState(targetDigit);
  const [to, setTo] = useState(targetDigit);
  const fromRef = useRef(from);
  const toRef = useRef(to);
  fromRef.current = from;
  toRef.current = to;

  // Track progress for mid-animation captures; clean up all state on unmount.
  useEffect(() => {
    const listenerId = anim.addListener(({ value }) => {
      progressRef.current = value;
    });
    return () => {
      runIdRef.current += 1;
      animRef.current?.stop();
      anim.removeListener(listenerId);
    };
  }, [anim]);

  // Reset the animated value and start the new animation only AFTER React has
  // committed the new `from`/`to` state to the native layer. This prevents the
  // one-frame flash that occurs when setValue(0) fires before the new digit
  // strings are visible to the native thread.
  useLayoutEffect(() => {
    if (!shouldStartAnim.current) return;
    shouldStartAnim.current = false;
    anim.setValue(0);
    progressRef.current = 0;
    const myId = runIdRef.current;
    const animation = Animated.timing(anim, {
      toValue: 1,
      duration: pendingDuration.current,
      delay: staggerDelay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animRef.current = animation;
    animation.start(({ finished }) => {
      if (!finished || runIdRef.current !== myId) return;
      progressRef.current = 1;
      // Leave anim at 1.0 — no reset here, no state update, no stale commit.
    });
  }, [from, to, anim, staggerDelay]);

  useEffect(() => {
    const currentFrom = fromRef.current;
    const currentTo = toRef.current;
    if (targetDigit === currentTo) return;
    runIdRef.current += 1;
    animRef.current?.stop();
    // Which digit is dominant at the moment of interruption?
    const visibleDigit = progressRef.current >= 0.5 ? currentTo : currentFrom;
    // Already showing the target visually — snap silently, no animation needed.
    if (visibleDigit === targetDigit) {
      fromRef.current = targetDigit;
      toRef.current = targetDigit;
      setFrom(targetDigit);
      setTo(targetDigit);
      return;
    }
    // Longer roll for digits that are farther apart.
    const distance = Math.abs(parseInt(targetDigit, 10) - parseInt(visibleDigit, 10));
    pendingDuration.current = DIGIT_BASE_DURATION + distance * 20;
    shouldStartAnim.current = true;
    fromRef.current = visibleDigit;
    toRef.current = targetDigit;
    setFrom(visibleDigit);
    setTo(targetDigit);
  }, [targetDigit]);

  const fromOpacity = anim.interpolate({
    inputRange: [0, 0.65, 1],
    outputRange: [1, 0.06, 0],
    extrapolate: 'clamp',
  });
  const fromTranslateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
    extrapolate: 'clamp',
  });
  const toOpacity = anim.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 0.1, 1],
    extrapolate: 'clamp',
  });
  const toTranslateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
    extrapolate: 'clamp',
  });

  return (
    <LinearGradient
      colors={['#DEDAD0', '#FDFAF5']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.rewardDigitShell}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(52,47,39,0.22)', 'rgba(52,47,39,0.11)', 'rgba(52,47,39,0.036)']}
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
          style={[styles.rewardDigitText, styles.rewardDigitHighlight, { opacity: fromOpacity, transform: [{ translateY: fromTranslateY }] }]}
          importantForAccessibility="no">
          {from}
        </Animated.Text>
        <Animated.Text
          style={[styles.rewardDigitText, styles.rewardDigitHighlight, { opacity: toOpacity, transform: [{ translateY: toTranslateY }] }]}
          importantForAccessibility="no">
          {to}
        </Animated.Text>
        <Animated.Text
          style={[styles.rewardDigitText, styles.rewardDigitEngraved, { opacity: fromOpacity, transform: [{ translateY: fromTranslateY }] }]}>
          {from}
        </Animated.Text>
        <Animated.Text
          style={[styles.rewardDigitText, styles.rewardDigitEngraved, { opacity: toOpacity, transform: [{ translateY: toTranslateY }] }]}>
          {to}
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
          <RewardDigit
            key={index}
            targetDigit={digit}
            staggerDelay={(targetDigits.length - 1 - index) * 40}
          />
        ))}
      </View>
      <Text style={styles.rewardCounterLabel}>POINTS</Text>
    </View>
  );
}

export default function SessionScreen() {
  const router = useRouter();
  const { height: screenHeight } = useWindowDimensions();
  const isCompact = screenHeight < 750;
  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);
  const noteComposerInputRef = useRef<TextInput>(null);
  const initialDuration = splitDuration(DEFAULT_DURATION_MINUTES);
  const [selectedHours, setSelectedHours] = useState(initialDuration.hours);
  const [selectedMinutes, setSelectedMinutes] = useState(initialDuration.minutes);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [isRulesVisible, setIsRulesVisible] = useState(false);
  const [isNoteComposerVisible, setIsNoteComposerVisible] = useState(false);
  const [sessionNote, setSessionNote] = useState('');
  const [selectedPurpose, setSelectedPurpose] = useState<string | undefined>();
  const availableMinuteOptions = selectedHours >= 12 ? LOCKED_MAX_MINUTE_OPTIONS : MINUTE_OPTIONS;
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
    const safeHours = Math.min(12, Math.max(0, nextHours));
    const safeMinutes = safeHours >= 12 ? 0 : Math.min(59, Math.max(0, nextMinutes));
    const clampedMinutes = clampDuration(safeHours * 60 + safeMinutes);
    const nextDuration = splitDuration(clampedMinutes);

    setSelectedHours(nextDuration.hours);
    setSelectedMinutes(nextDuration.minutes);
  };

  const togglePurposeChip = (purpose: string) => {
    setSelectedPurpose((currentPurpose) => (currentPurpose === purpose ? undefined : purpose));
  };

  useEffect(() => {
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setIsNoteComposerVisible(false);
    });

    return () => hideSubscription.remove();
  }, []);

  const handleNoteFocus = () => {
    setIsNoteComposerVisible(true);
    requestAnimationFrame(() => {
      noteComposerInputRef.current?.focus();
    });
  };

  const closeNoteComposer = () => {
    setIsNoteComposerVisible(false);
    Keyboard.dismiss();
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={styles.keyboardAvoider}>
        <View style={[styles.container, isCompact && styles.containerCompact]}>
          <View style={[styles.targetPanel, { gap: isCompact ? spacing.xs : spacing.sm }]}>
            <View style={[styles.timerZone, { gap: isCompact ? spacing.xs : spacing.sm }]}>
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

                <View style={styles.wheelSeparatorWrap}>
                  <Text style={[styles.wheelSeparator, styles.wheelSeparatorHighlight]} importantForAccessibility="no">:</Text>
                  <Text style={[styles.wheelSeparator, styles.wheelSeparatorEngraved]}>:</Text>
                </View>

                <WheelPicker
                  label="MIN"
                  options={availableMinuteOptions}
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
                  colors={['#DEDAD0', '#FDFAF5']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={[
                    styles.noteSeat,
                    { height: isCompact ? TIMER_SETTINGS_COMPACT_NOTE_HEIGHT : TIMER_SETTINGS_NOTE_HEIGHT },
                  ]}>
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(52,47,39,0.22)', 'rgba(52,47,39,0.11)', 'rgba(52,47,39,0.036)']}
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
                    <LinearGradient
                      pointerEvents="none"
                      colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.52)', 'rgba(255,255,255,0.52)', 'rgba(255,255,255,0)']}
                      locations={[0, 0.22, 0.78, 1]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={styles.noteBottomGlint}
                    />
                    <TextInput
                      multiline
                      placeholder="Add a note (optional)"
                      placeholderTextColor="rgba(102,107,103,0.62)"
                      value={sessionNote}
                      onChangeText={setSessionNote}
                      onFocus={handleNoteFocus}
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
                <InfoButton style={styles.rewardInfoButton} onPress={() => setIsRulesVisible(true)} />
                <RewardCounter rewardPoints={sessionPreview.rewardPoints} />
              </View>

              <CeramicButton
                size="medium"
                onPress={() => setIsConfirmVisible(true)}
                hitSlop={{ top: 4, bottom: 16, left: 6, right: 6 }}
                style={styles.startButtonPressable}
                surfaceStyle={styles.startButtonSurface}>
                <HardwareLed size="medium" />
                <Text style={styles.buttonText}>Start detox</Text>
              </CeramicButton>
            </View>
          </View>
        </View>

        {isNoteComposerVisible ? (
          <View style={styles.noteComposerDock}>
            <LinearGradient
              colors={['#DCD7CD', '#FDF9F1']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.noteComposerSeat}>
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(52,47,39,0.22)', 'rgba(52,47,39,0.1)', 'rgba(52,47,39,0.034)']}
                locations={[0, 0.5, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.noteComposerContactGap}
              />
              <View pointerEvents="none" style={styles.noteComposerCavityShadow} />
              <View style={styles.noteComposerField}>
                <LinearGradient
                  pointerEvents="none"
                  colors={['rgba(17,19,18,0.09)', 'rgba(17,19,18,0.026)', 'rgba(17,19,18,0)']}
                  locations={[0, 0.44, 1]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.noteComposerTopShade}
                />
                <LinearGradient
                  pointerEvents="none"
                  colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.2)']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.noteComposerBottomHighlight}
                />
                <View style={styles.noteComposerHeader}>
                  <Text style={styles.noteComposerLabel}>NOTE</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Done editing note"
                    onPress={closeNoteComposer}
                    hitSlop={8}
                    style={styles.noteComposerDone}>
                    <Text style={styles.noteComposerDoneText}>Done</Text>
                  </Pressable>
                </View>
                <TextInput
                  ref={noteComposerInputRef}
                  multiline
                  scrollEnabled
                  placeholder="Add a note (optional)"
                  placeholderTextColor="rgba(102,107,103,0.62)"
                  value={sessionNote}
                  onChangeText={setSessionNote}
                  style={styles.noteComposerInput}
                  textAlignVertical="top"
                />
              </View>
            </LinearGradient>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={isConfirmVisible}
        targetTime={sessionPreview.targetTime}
        durationLabel={sessionPreview.durationLabel}
        rewardLabel={sessionPreview.rewardLabel}
        purpose={selectedPurpose}
        note={sessionNote.trim() || undefined}
        onCancel={() => setIsConfirmVisible(false)}
        onConfirm={startSession}
      />
      <AnchorRulesModal visible={isRulesVisible} onClose={() => setIsRulesVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoider: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingTop: TIMER_SETTINGS_TOP_PADDING,
    paddingBottom: TIMER_SETTINGS_ACTION_TO_NAV_GAP,
  },
  containerCompact: {
    paddingTop: spacing.sm,
    paddingBottom: TIMER_SETTINGS_COMPACT_ACTION_TO_NAV_GAP,
  },
  targetPanel: {
    flex: 1,
    justifyContent: 'space-between',
  },
  timerZone: {
    flexShrink: 0,
  },
  formZone: {
    flex: 0,
    justifyContent: 'flex-start',
    gap: TIMER_SETTINGS_FORM_GAP,
  },
  actionZone: {
    flex: 0,
    justifyContent: 'flex-start',
    gap: TIMER_SETTINGS_ACTION_GAP,
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
    textShadowColor: 'rgba(0,0,0,0.16)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 0.5,
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
    textShadowColor: 'rgba(0,0,0,0.16)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 0.5,
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
    backgroundColor: 'rgba(17,19,18,0.022)',
    shadowColor: '#111312',
    shadowOpacity: 0.24,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
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
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
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
    opacity: 0.65,
  },
  nearWheelText: {
    opacity: 0.85,
  },
  farWheelText: {
    opacity: 0.32,
  },
  selectedWheelText: {
    fontFamily: typography.meta.fontFamily,
    color: colors.ink,
    fontSize: 34,
    lineHeight: WHEEL_ITEM_HEIGHT,
    opacity: 1,
  },
  wheelEngravedWrap: {
    alignItems: 'center',
  },
  selectedWheelHighlight: {
    position: 'absolute',
    top: 2,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.72)',
  },
  selectedWheelEngraved: {
    color: 'rgba(17,19,18,0.88)',
    textShadowColor: 'rgba(0,0,0,0.22)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 1,
  },
  wheelSeparator: {
    fontFamily: typography.meta.fontFamily,
    alignSelf: 'center',
    color: 'rgba(17,19,18,0.58)',
    fontSize: 38,
    lineHeight: 42,
  },
  wheelSeparatorWrap: {
    alignSelf: 'center',
    marginTop: spacing.lg,
  },
  wheelSeparatorHighlight: {
    position: 'absolute',
    top: 1,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.68)',
  },
  wheelSeparatorEngraved: {
    color: 'rgba(17,19,18,0.52)',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 1,
  },
  purposeSection: {
    gap: 5,
  },
  purposeCluster: {
    width: '100%',
    marginHorizontal: -OPTICAL_ROUNDED_OUTSET,
  },
  purposeLabel: {
    ...typography.panelLabel,
    color: colors.muted,
    marginHorizontal: OPTICAL_LABEL_INSET,
    textShadowColor: 'rgba(0,0,0,0.16)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 0.5,
  },
  purposeChipRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  purposeChipSurface: {
    gap: 0,
    paddingLeft: 0,
    paddingRight: 6,
  },
  purposeChipText: {
    ...typography.chip,
    color: colors.muted,
    fontSize: 9,
    lineHeight: 12,
  },
  selectedPurposeChipSurface: {},
  selectedPurposeChipText: {
    color: colors.ink,
  },
  noteSection: {
    gap: 5,
  },
  noteSeat: {
    width: '100%',
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
  noteCavityShadow: {
    position: 'absolute',
    top: NOTE_GAP_INSET + 1,
    right: NOTE_GAP_INSET + 1,
    bottom: NOTE_GAP_INSET + 1,
    left: NOTE_GAP_INSET + 1,
    borderRadius: NOTE_GAP_RADIUS - 1,
    backgroundColor: 'rgba(17,19,18,0.022)',
    shadowColor: '#111312',
    shadowOpacity: 0.24,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
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
  noteBottomGlint: {
    position: 'absolute',
    bottom: 1,
    left: 0,
    right: 0,
    height: 1,
    borderRadius: 1,
    zIndex: 3,
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
    marginHorizontal: OPTICAL_LABEL_INSET,
    textShadowColor: 'rgba(0,0,0,0.16)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 0.5,
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
  noteComposerDock: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingBottom: spacing.sm,
  },
  noteComposerSeat: {
    borderRadius: 22,
    padding: 6,
    position: 'relative',
  },
  noteComposerContactGap: {
    position: 'absolute',
    top: 4,
    right: 4,
    bottom: 4,
    left: 4,
    borderRadius: 20,
  },
  noteComposerCavityShadow: {
    position: 'absolute',
    top: 5,
    right: 5,
    bottom: 5,
    left: 5,
    borderRadius: 19,
    backgroundColor: 'rgba(17,19,18,0.024)',
    shadowColor: '#111312',
    shadowOpacity: 0.2,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  noteComposerField: {
    minHeight: 128,
    maxHeight: 168,
    overflow: 'hidden',
    borderRadius: 17,
    backgroundColor: '#E4E0D8',
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 12,
    position: 'relative',
    zIndex: 1,
  },
  noteComposerTopShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: 34,
  },
  noteComposerBottomHighlight: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    height: 18,
  },
  noteComposerHeader: {
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  noteComposerLabel: {
    ...typography.panelLabel,
    color: colors.muted,
    textShadowColor: 'rgba(0,0,0,0.16)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 0.5,
  },
  noteComposerDone: {
    minHeight: 28,
    minWidth: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(246,243,236,0.58)',
    shadowColor: '#111312',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  noteComposerDoneText: {
    ...typography.chip,
    color: colors.sage,
    fontSize: 11,
    lineHeight: 14,
  },
  noteComposerInput: {
    ...typography.body,
    zIndex: 2,
    minHeight: 76,
    maxHeight: 112,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 19,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  rewardCard: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    position: 'relative',
  },
  rewardInfoButton: {
    position: 'absolute',
    right: 34,
    top: 30,
  },
  rewardLabel: {
    ...typography.panelLabel,
    color: colors.muted,
    textShadowColor: 'rgba(0,0,0,0.16)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 0.5,
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
    backgroundColor: 'rgba(17,19,18,0.022)',
    shadowColor: '#111312',
    shadowOpacity: 0.22,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
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
  rewardDigitHighlight: {
    top: 2,
    color: 'rgba(255,255,255,0.68)',
  },
  rewardDigitEngraved: {
    color: 'rgba(17,19,18,0.84)',
    textShadowColor: 'rgba(0,0,0,0.22)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 1,
  },
  rewardCounterLabel: {
    ...typography.instrumentLabel,
    color: colors.muted,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.8,
  },
  startButtonSurface: {
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 0,
    paddingRight: 12,
  },
  startButtonPressable: {
    paddingBottom: 10,
    marginBottom: -10,
  },
  buttonText: {
    ...typography.button,
    color: colors.sage,
    fontSize: 16,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 1,
  },
});







