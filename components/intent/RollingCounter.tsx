import { LinearGradient } from 'expo-linear-gradient';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '../../constants/theme';

const DIGIT_HEIGHT = 30;
const DIGIT_BASE_DURATION = 155;
const TRAVEL = 13;

type DigitProps = {
  targetDigit: string;
  staggerDelay: number;
};

function Digit({ targetDigit, staggerDelay }: DigitProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const runIdRef = useRef(0);
  const progressRef = useRef(0);
  const shouldStartAnim = useRef(false);
  const pendingDuration = useRef(DIGIT_BASE_DURATION);
  // 1 = roll upward (increment), -1 = roll downward (decrement)
  const directionRef = useRef(1);
  const [from, setFrom] = useState(targetDigit);
  const [to, setTo] = useState(targetDigit);
  const fromRef = useRef(from);
  const toRef = useRef(to);
  fromRef.current = from;
  toRef.current = to;

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
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    });
    animRef.current = animation;
    animation.start(({ finished }) => {
      if (!finished || runIdRef.current !== myId) return;
      progressRef.current = 1;
    });
  }, [from, to, anim, staggerDelay]);

  useEffect(() => {
    const currentFrom = fromRef.current;
    const currentTo = toRef.current;
    if (targetDigit === currentTo) return;
    runIdRef.current += 1;
    animRef.current?.stop();
    const visibleDigit = progressRef.current >= 0.5 ? currentTo : currentFrom;
    if (visibleDigit === targetDigit) {
      fromRef.current = targetDigit;
      toRef.current = targetDigit;
      setFrom(targetDigit);
      setTo(targetDigit);
      return;
    }
    // Determine scroll direction using shortest path on the 0-9 wheel.
    // diff > 5 means wrapping down (0→9 = decrement), diff < -5 means wrapping up (9→0 = increment).
    const diff = parseInt(targetDigit, 10) - parseInt(visibleDigit, 10);
    const shortDiff = diff > 5 ? diff - 10 : diff < -5 ? diff + 10 : diff;
    directionRef.current = shortDiff >= 0 ? 1 : -1;
    const distance = Math.abs(shortDiff);
    pendingDuration.current = DIGIT_BASE_DURATION + distance * 22;
    shouldStartAnim.current = true;
    fromRef.current = visibleDigit;
    toRef.current = targetDigit;
    setFrom(visibleDigit);
    setTo(targetDigit);
  }, [targetDigit]);

  const dir = directionRef.current;
  // Departing digit: exits quickly, arriving digit: enters crisply after brief overlap gap
  const fromOpacity = anim.interpolate({ inputRange: [0, 0.38, 0.62, 1], outputRange: [1, 0.7, 0.04, 0], extrapolate: 'clamp' });
  const fromTranslateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -TRAVEL * dir], extrapolate: 'clamp' });
  const toOpacity = anim.interpolate({ inputRange: [0, 0.38, 0.62, 1], outputRange: [0, 0.04, 0.7, 1], extrapolate: 'clamp' });
  const toTranslateY = anim.interpolate({ inputRange: [0, 1], outputRange: [TRAVEL * dir, 0], extrapolate: 'clamp' });

  return (
    <LinearGradient
      colors={['#C8C4BA', '#F6F3EC']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.shell}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(52,47,39,0.30)', 'rgba(52,47,39,0.08)', 'rgba(52,47,39,0.08)', 'rgba(52,47,39,0.24)']}
        locations={[0, 0.36, 0.64, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.contactGap}
      />
      <View pointerEvents="none" style={styles.cavityShadow} />
      <View style={styles.field}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(17,19,18,0.18)', 'rgba(17,19,18,0.05)', 'rgba(17,19,18,0)']}
          locations={[0, 0.45, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.topShade}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.94)', 'rgba(252,250,246,0.84)', 'rgba(242,238,231,0.5)']}
          locations={[0, 0.52, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.glass}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.72)', 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0)']}
          locations={[0, 0.38, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.sheen}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(52,47,39,0)', 'rgba(52,47,39,0.065)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.lowerDepth}
        />
        <View pointerEvents="none" style={styles.bottomGlint} />
        <Animated.Text
          style={[styles.digitText, styles.highlight, { opacity: fromOpacity, transform: [{ translateY: fromTranslateY }] }]}
          importantForAccessibility="no">
          {from}
        </Animated.Text>
        <Animated.Text
          style={[styles.digitText, styles.highlight, { opacity: toOpacity, transform: [{ translateY: toTranslateY }] }]}
          importantForAccessibility="no">
          {to}
        </Animated.Text>
        <Animated.Text
          style={[styles.digitText, styles.engraved, { opacity: fromOpacity, transform: [{ translateY: fromTranslateY }] }]}>
          {from}
        </Animated.Text>
        <Animated.Text
          style={[styles.digitText, styles.engraved, { opacity: toOpacity, transform: [{ translateY: toTranslateY }] }]}>
          {to}
        </Animated.Text>
      </View>
    </LinearGradient>
  );
}

type RollingCounterProps = {
  value: number;
  digits?: number;
  label?: string;
  maxValue?: number;
  noComma?: boolean;
};

export function RollingCounter({ value, digits = 5, label, maxValue, noComma }: RollingCounterProps) {
  const max = maxValue ?? Math.pow(10, digits) - 1;
  const targetDigits = useMemo(
    () => String(Math.min(max, Math.max(0, Math.floor(value)))).padStart(digits, '0').split(''),
    [value, digits, max]
  );

  return (
    <View style={styles.counter}>
      <View style={styles.counterRow}>
        {targetDigits.map((digit, index) => (
          <Fragment key={index}>
            {!noComma && index > 0 && (digits - index) % 3 === 0 && (
              <Text style={styles.commaText}>,</Text>
            )}
            <Digit
              targetDigit={digit}
              staggerDelay={(targetDigits.length - 1 - index) * 40}
            />
          </Fragment>
        ))}
      </View>
      {label ? <Text style={styles.counterLabel}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  counter: {
    alignItems: 'center',
    gap: 4,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  shell: {
    width: 30,
    height: 40,
    overflow: 'hidden',
    borderRadius: 13,
    padding: 4,
    position: 'relative',
  },
  contactGap: {
    position: 'absolute',
    top: 3,
    right: 3,
    bottom: 3,
    left: 3,
    borderRadius: 11,
  },
  cavityShadow: {
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
  field: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 9,
    backgroundColor: '#E4E0D8',
    position: 'relative',
  },
  topShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 11,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    zIndex: 1,
  },
  glass: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 9,
  },
  sheen: {
    position: 'absolute',
    top: 1,
    right: 2,
    left: 2,
    height: 13,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  lowerDepth: {
    position: 'absolute',
    right: 1,
    bottom: 0,
    left: 1,
    height: 12,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  bottomGlint: {
    position: 'absolute',
    right: 6,
    bottom: 1,
    left: 6,
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.66)',
    opacity: 0.72,
  },
  digitText: {
    position: 'absolute',
    top: 1,
    right: 0,
    left: 0,
    fontFamily: typography.meta.fontFamily,
    height: DIGIT_HEIGHT,
    color: colors.ink,
    fontSize: 20,
    lineHeight: DIGIT_HEIGHT,
    textAlign: 'center',
  },
  highlight: {
    top: 2,
    color: 'rgba(255,255,255,0.68)',
  },
  engraved: {
    color: 'rgba(17,19,18,0.84)',
    textShadowColor: 'rgba(0,0,0,0.22)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 1,
  },
  commaText: {
    fontFamily: typography.meta.fontFamily,
    fontSize: 14,
    color: 'rgba(17,19,18,0.45)',
    alignSelf: 'flex-end',
    marginBottom: 1,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 0.5,
  },
  counterLabel: {
    ...typography.instrumentLabel,
    color: colors.muted,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.8,
  },
});
