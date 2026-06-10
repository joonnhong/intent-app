import { memo, useEffect, useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polygon } from 'react-native-svg';

import { colors, typography } from '../../constants/theme';
import { HardwareLed } from './HardwareLed';
import { RollingCounter } from './RollingCounter';

const TIMER_DIAL_VIEWBOX_SIZE = 342;
export const TIMER_DIAL_SIZE = 360;
const TIMER_DIAL_CENTER = TIMER_DIAL_VIEWBOX_SIZE / 2;
const TOTAL_TICKS = 96;
const TICK_RADIUS = 128;
const TICK_LENGTH = 6.6;
const TICK_CARDINAL_LENGTH = 12;
const TICK_SECONDARY_MAJOR_LENGTH = TICK_CARDINAL_LENGTH;
const TICK_STROKE_WIDTH = 1.25;
const TICK_MAJOR_STROKE_WIDTH = 1.45;
const TICK_CARDINAL_STROKE_WIDTH = 1.75;
const TICK_SECONDARY_MAJOR_STROKE_WIDTH = TICK_CARDINAL_STROKE_WIDTH;
const TICK_START_ANGLE_OFFSET = -90;
const TICK_SECONDARY_MAJOR_INTERVAL = TOTAL_TICKS / 8;
const TICK_CARDINAL_INTERVAL = TOTAL_TICKS / 4;
const POINTER_RADIUS = 106;
const POINTER_SIZE = 11;
const POINTER_ANGLE_OFFSET = 0;
const POINTER_ANIMATION_DURATION_MS = 160;
const STATUS_GLOW_RADIUS = 143;
const STATUS_GLOW_STROKE_WIDTH = 14;
const STATUS_GLOW_SOFT_WIDTH = 22;
const STATUS_GLOW_OPACITY = {
  loading: 0.02,
  running: 0.14,
  warning: 0.31,
  success: 0.38,
  ended: 0.33,
  failed: 0.36,
} as const;

export type TimerDialVisualState = 'loading' | 'running' | 'warning' | 'success' | 'ended' | 'failed';

export type TimerDialProps = {
  size?: number;
  progress: number;
  remainingTime: string;
  visualState: TimerDialVisualState;
  penaltyCount?: number;
  isStill?: boolean;
};

type TimerDialLayer = {
  key: string;
  source: ImageSourcePropType;
};

type LedTone = 'orange' | 'sage' | 'success';
type TickTone = 'neutral' | 'sage' | 'success' | 'orange' | 'clay';
type PointerTone = 'neutral' | 'sage' | 'orange';
type StatusGlowTone = 'neutral' | 'sage' | 'success' | 'orange' | 'clay';

const TIMER_DIAL_LAYERS: TimerDialLayer[] = [
  {
    key: 'background-bevel-frame',
    source: require('../../assets/timer-dial/1-background-bevel-frame.png'),
  },
  {
    key: 'outer-white-ring-frame',
    source: require('../../assets/timer-dial/2-outer-white-ring-frame.png'),
  },
  {
    key: 'led-glow-ring-level-frame',
    source: require('../../assets/timer-dial/3-led-glow-ring-level-frame.png'),
  },
  {
    key: 'led-count-layer-frame',
    source: require('../../assets/timer-dial/4-led-count-layer-frame.png'),
  },
  {
    key: 'triangle-arrow-rotate-dial-layer-frame',
    source: require('../../assets/timer-dial/5-triangle-arrow-rotate-dial-layer-frame.png'),
  },
  {
    key: 'inner-layer-timer-with-led-and-digit-rolling-wheel-frame',
    source: require('../../assets/timer-dial/6-inner-layer-timer-with-led-and-digit-rolling-wheel-frame.png'),
  },
];

function TimerDialLayerStack({
  size,
  from = 0,
  to = TIMER_DIAL_LAYERS.length,
}: {
  size: number;
  from?: number;
  to?: number;
}) {
  return (
    <View style={[styles.layerStack, { width: size, height: size }]}>
      {TIMER_DIAL_LAYERS.slice(from, to).map((layer) => (
        <Image
          key={layer.key}
          source={layer.source}
          resizeMode="contain"
          style={[styles.layerImage, { width: size, height: size }]}
        />
      ))}
    </View>
  );
}

function getTickTone(visualState: TimerDialVisualState): TickTone {
  if (visualState === 'success') {
    return 'success';
  }

  if (visualState === 'ended') {
    return 'clay';
  }

  if (visualState === 'warning' || visualState === 'failed') {
    return 'orange';
  }

  return visualState === 'running' ? 'sage' : 'neutral';
}

function getTickColors(tone: TickTone) {
  if (tone === 'sage') {
    return {
      active: colors.sageLight,
      glow: colors.sageGlow,
    };
  }

  if (tone === 'success') {
    return {
      active: colors.successGreen,
      glow: colors.successGlow,
    };
  }

  if (tone === 'orange') {
    return {
      active: colors.alertOrangeRed,
      glow: colors.alertGlow,
    };
  }

  if (tone === 'clay') {
    return {
      active: colors.alertRed,
      glow: colors.alertGlow,
    };
  }

  return {
    active: 'rgba(102,107,103,0.24)',
    glow: 'rgba(102,107,103,0.05)',
  };
}

function getPointerTone(visualState: TimerDialVisualState): PointerTone {
  if (visualState === 'running' || visualState === 'success') {
    return 'sage';
  }

  if (visualState === 'warning' || visualState === 'ended' || visualState === 'failed') {
    return 'orange';
  }

  return 'neutral';
}

function getPointerColors(tone: PointerTone) {
  if (tone === 'sage') {
    return {
      face: colors.sage,
      faceOpacity: 0.72,
    };
  }

  if (tone === 'orange') {
    return {
      face: colors.alertOrangeRed,
      faceOpacity: 0.74,
    };
  }

  return {
    face: colors.faint,
    faceOpacity: 0.54,
  };
}

function getStatusGlowTone(visualState: TimerDialVisualState): StatusGlowTone {
  if (visualState === 'success') {
    return 'success';
  }

  if (visualState === 'ended') {
    return 'clay';
  }

  if (visualState === 'warning' || visualState === 'failed') {
    return 'orange';
  }

  return visualState === 'running' ? 'sage' : 'neutral';
}

function getStatusGlowColor(tone: StatusGlowTone) {
  if (tone === 'sage') {
    return colors.sageLight;
  }

  if (tone === 'success') {
    return colors.successGreen;
  }

  if (tone === 'orange') {
    return colors.alertOrangeRed;
  }

  if (tone === 'clay') {
    return colors.alertRed;
  }

  return colors.muted;
}

function getPointerTargetAngle(progress: number, visualState: TimerDialVisualState) {
  if (visualState === 'success') {
    return 360 + POINTER_ANGLE_OFFSET;
  }

  if (visualState === 'loading') {
    return POINTER_ANGLE_OFFSET;
  }

  return Math.max(0, Math.min(1, progress)) * 360 + POINTER_ANGLE_OFFSET;
}

function StatusGlowOverlay({
  size,
  visualState,
}: {
  size: number;
  visualState: TimerDialVisualState;
}) {
  const glowTone = getStatusGlowTone(visualState);
  const glowColor = getStatusGlowColor(glowTone);
  const glowOpacity = STATUS_GLOW_OPACITY[visualState];

  return (
    <Svg
      pointerEvents="none"
      width={size}
      height={size}
      viewBox={`0 0 ${TIMER_DIAL_VIEWBOX_SIZE} ${TIMER_DIAL_VIEWBOX_SIZE}`}
      style={styles.statusGlowOverlay}>
      <Circle
        cx={TIMER_DIAL_CENTER}
        cy={TIMER_DIAL_CENTER + 1.4}
        r={STATUS_GLOW_RADIUS + 0.8}
        fill="none"
        stroke="rgba(52,47,39,0.18)"
        strokeWidth={3.4}
        opacity={glowOpacity * 0.34}
      />
      <Circle
        cx={TIMER_DIAL_CENTER}
        cy={TIMER_DIAL_CENTER}
        r={STATUS_GLOW_RADIUS}
        fill="none"
        stroke={glowColor}
        strokeWidth={STATUS_GLOW_SOFT_WIDTH}
        opacity={glowOpacity * 0.46}
      />
      <Circle
        cx={TIMER_DIAL_CENTER}
        cy={TIMER_DIAL_CENTER}
        r={STATUS_GLOW_RADIUS}
        fill="none"
        stroke={glowColor}
        strokeWidth={STATUS_GLOW_STROKE_WIDTH}
        opacity={glowOpacity}
      />
      <Circle
        cx={TIMER_DIAL_CENTER}
        cy={TIMER_DIAL_CENTER}
        r={STATUS_GLOW_RADIUS - 1.8}
        fill="none"
        stroke={glowColor}
        strokeWidth={5.5}
        opacity={glowOpacity * 0.68}
      />
      <Circle
        cx={TIMER_DIAL_CENTER}
        cy={TIMER_DIAL_CENTER - 0.9}
        r={STATUS_GLOW_RADIUS - 5.4}
        fill="none"
        stroke="rgba(255,252,246,0.42)"
        strokeWidth={1.6}
        opacity={glowOpacity * 0.56}
      />
      <Circle
        cx={TIMER_DIAL_CENTER}
        cy={TIMER_DIAL_CENTER}
        r={STATUS_GLOW_RADIUS - STATUS_GLOW_STROKE_WIDTH * 0.22}
        fill="none"
        stroke="rgba(255,252,246,0.32)"
        strokeWidth={1.2}
        opacity={glowOpacity * 0.72}
      />
    </Svg>
  );
}

function ProgressTickRing({
  size,
  progress,
  visualState,
}: {
  size: number;
  progress: number;
  visualState: TimerDialVisualState;
}) {
  const safeProgress = Math.max(0, Math.min(1, progress));
  const activeTickCount = visualState === 'success' ? TOTAL_TICKS : visualState === 'loading' ? 0 : Math.floor(safeProgress * TOTAL_TICKS + 1e-6);
  const tickTone = getTickTone(visualState);
  const tickColors = getTickColors(tickTone);

  const ticks = useMemo(() => {
    const out: ReactElement[] = [];

    for (let i = 0; i < TOTAL_TICKS; i += 1) {
      const angleDeg = TICK_START_ANGLE_OFFSET + (i / TOTAL_TICKS) * 360;
      const angle = (angleDeg * Math.PI) / 180;
      const isMajor = i % 6 === 0;
      const isCardinal = i % TICK_CARDINAL_INTERVAL === 0;
      const isSecondaryMajor = !isCardinal && i % TICK_SECONDARY_MAJOR_INTERVAL === 0;
      const tickLength = isCardinal ? TICK_CARDINAL_LENGTH : isSecondaryMajor ? TICK_SECONDARY_MAJOR_LENGTH : TICK_LENGTH;
      const innerRadius = TICK_RADIUS - tickLength;
      const outerRadius = TICK_RADIUS;
      const x1 = TIMER_DIAL_CENTER + Math.cos(angle) * innerRadius;
      const y1 = TIMER_DIAL_CENTER + Math.sin(angle) * innerRadius;
      const x2 = TIMER_DIAL_CENTER + Math.cos(angle) * outerRadius;
      const y2 = TIMER_DIAL_CENTER + Math.sin(angle) * outerRadius;
      const strokeWidth = isCardinal
        ? TICK_CARDINAL_STROKE_WIDTH
        : isSecondaryMajor
        ? TICK_SECONDARY_MAJOR_STROKE_WIDTH
        : isMajor
        ? TICK_MAJOR_STROKE_WIDTH
        : TICK_STROKE_WIDTH;
      const isActive = i < activeTickCount;

      out.push(
        <G key={`progress-tick-${i}`}>
          <Line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="rgba(52,47,39,0.12)"
            strokeWidth={strokeWidth + 2.2}
            strokeLinecap="round"
            opacity={0.12}
          />
          <Line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="rgba(246,243,236,0.72)"
            strokeWidth={strokeWidth + 0.8}
            strokeLinecap="round"
            opacity={0.58}
          />
          <Line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="rgba(102,107,103,0.28)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            opacity={0.44}
          />
          {isActive ? (
            <>
              <Line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={tickColors.glow}
                strokeWidth={strokeWidth + 3.4}
                strokeLinecap="round"
                opacity={tickTone === 'success' ? 0.62 : 0.7}
              />
              <Line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={tickColors.active}
                strokeWidth={strokeWidth + 1}
                strokeLinecap="round"
                opacity={tickTone === 'success' ? 0.48 : 0.5}
              />
              <Line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={tickColors.active}
                strokeWidth={strokeWidth + 0.2}
                strokeLinecap="round"
                opacity={tickTone === 'success' ? 0.76 : tickTone === 'neutral' ? 0.42 : 0.84}
              />
              <Line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(255,252,246,0.58)"
                strokeWidth={0.72}
                strokeLinecap="round"
                opacity={tickTone === 'success' ? 0.58 : 0.68}
              />
            </>
          ) : null}
        </G>,
      );
    }

    return out;
  }, [activeTickCount, tickColors.active, tickColors.glow, tickTone]);

  return (
    <Svg
      pointerEvents="none"
      width={size}
      height={size}
      viewBox={`0 0 ${TIMER_DIAL_VIEWBOX_SIZE} ${TIMER_DIAL_VIEWBOX_SIZE}`}
      style={styles.progressOverlay}>
      <G>{ticks}</G>
    </Svg>
  );
}

function RotatingTrianglePointer({
  size,
  progress,
  visualState,
}: {
  size: number;
  progress: number;
  visualState: TimerDialVisualState;
}) {
  const safeProgress = Math.max(0, Math.min(1, progress));
  const targetAngle = getPointerTargetAngle(safeProgress, visualState);
  const animatedAngle = useRef(new Animated.Value(targetAngle)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const pointerTone = getPointerTone(visualState);
  const pointerColors = getPointerColors(pointerTone);
  const animatedRotation = animatedAngle.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });
  const apexY = TIMER_DIAL_CENTER - POINTER_RADIUS - POINTER_SIZE * 0.62;
  const baseY = TIMER_DIAL_CENTER - POINTER_RADIUS + POINTER_SIZE * 0.52;
  const halfBase = POINTER_SIZE * 0.46;
  const outerPoints = `${TIMER_DIAL_CENTER},${apexY} ${TIMER_DIAL_CENTER - halfBase},${baseY} ${TIMER_DIAL_CENTER + halfBase},${baseY}`;
  const shadowPoints = `${TIMER_DIAL_CENTER},${apexY + 1.15} ${TIMER_DIAL_CENTER - halfBase},${baseY + 1.15} ${TIMER_DIAL_CENTER + halfBase},${baseY + 1.15}`;
  const innerApexY = apexY + POINTER_SIZE * 0.28;
  const innerBaseY = baseY - POINTER_SIZE * 0.22;
  const innerHalfBase = halfBase * 0.52;
  const innerPoints = `${TIMER_DIAL_CENTER},${innerApexY} ${TIMER_DIAL_CENTER - innerHalfBase},${innerBaseY} ${TIMER_DIAL_CENTER + innerHalfBase},${innerBaseY}`;
  const topHighlightPoints = `${TIMER_DIAL_CENTER},${apexY + 1.15} ${TIMER_DIAL_CENTER - halfBase * 0.42},${baseY - POINTER_SIZE * 0.42} ${TIMER_DIAL_CENTER},${innerApexY + 0.6}`;
  const lowerShadePoints = `${TIMER_DIAL_CENTER - innerHalfBase},${innerBaseY} ${TIMER_DIAL_CENTER + innerHalfBase},${innerBaseY} ${TIMER_DIAL_CENTER + halfBase * 0.72},${baseY - 0.4} ${TIMER_DIAL_CENTER - halfBase * 0.72},${baseY - 0.4}`;

  useEffect(() => {
    animationRef.current?.stop();
    animationRef.current = null;

    if (visualState === 'loading') {
      animatedAngle.setValue(targetAngle);
      return undefined;
    }

    animatedAngle.stopAnimation((currentAngle) => {
      animatedAngle.setValue(currentAngle);
      const animation = Animated.timing(animatedAngle, {
        toValue: targetAngle,
        duration: POINTER_ANIMATION_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

      animationRef.current = animation;
      animation.start(({ finished }) => {
        if (finished) {
          animationRef.current = null;
        }
      });
    });

    return () => {
      animationRef.current?.stop();
      animationRef.current = null;
    };
  }, [animatedAngle, targetAngle, visualState]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.pointerOverlay, { transform: [{ rotate: animatedRotation }] }]}>
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${TIMER_DIAL_VIEWBOX_SIZE} ${TIMER_DIAL_VIEWBOX_SIZE}`}>
      <G>
        <Polygon points={shadowPoints} fill="rgba(52,47,39,0.18)" opacity={0.26} />
        <Polygon points={outerPoints} fill="#DEDAD0" opacity={0.94} />
        <Polygon points={outerPoints} fill="rgba(246,243,236,0.74)" opacity={0.72} />
        <Polygon points={lowerShadePoints} fill="rgba(52,47,39,0.16)" opacity={0.34} />
        <Polygon points={innerPoints} fill={pointerColors.face} opacity={pointerColors.faceOpacity} />
        <Polygon points={topHighlightPoints} fill="rgba(246,243,236,0.70)" opacity={0.68} />
      </G>
      </Svg>
    </Animated.View>
  );
}

function getTimeDisplayParts(remainingTime: string) {
  const digits = remainingTime.replace(/\D/g, '').padStart(4, '0').slice(-4);

  return {
    minutes: Number(digits.slice(0, 2)),
    seconds: Number(digits.slice(2, 4)),
  };
}

function getLedTone(visualState: TimerDialVisualState): LedTone {
  return visualState === 'success' ? 'success' : 'orange';
}

function isLedOn(visualState: TimerDialVisualState) {
  return visualState !== 'loading';
}

function getLedPulseConfig(visualState: TimerDialVisualState) {
  if (visualState === 'warning' || visualState === 'failed') {
    return {
      low: 0.34,
      rise: 420,
      hold: 100,
      fall: 520,
      rest: 120,
    };
  }

  if (visualState === 'ended') {
    return {
      low: 0.44,
      rise: 520,
      hold: 120,
      fall: 620,
      rest: 180,
    };
  }

  return {
    low: 0.38,
    rise: 640,
    hold: 160,
    fall: 720,
    rest: 180,
  };
}

function TimerDialCenterDisplay({
  size,
  remainingTime,
  visualState,
}: {
  size: number;
  remainingTime: string;
  visualState: TimerDialVisualState;
}) {
  const scale = size / TIMER_DIAL_VIEWBOX_SIZE;
  const timeScale = scale * 1.12;
  const pulseOpacity = useRef(new Animated.Value(1)).current;
  const shouldPulse = visualState === 'running' || visualState === 'warning';
  const ledOn = isLedOn(visualState);
  const ledTone = getLedTone(visualState);
  const timeParts = useMemo(() => getTimeDisplayParts(remainingTime), [remainingTime]);

  useEffect(() => {
    pulseOpacity.stopAnimation();

    if (!ledOn) {
      pulseOpacity.setValue(1);
      return;
    }

    if (!shouldPulse) {
      pulseOpacity.setValue(1);
      return;
    }

    const pulseConfig = getLedPulseConfig(visualState);
    pulseOpacity.setValue(pulseConfig.low);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, {
          toValue: 1,
          duration: pulseConfig.rise,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.delay(pulseConfig.hold),
        Animated.timing(pulseOpacity, {
          toValue: pulseConfig.low,
          duration: pulseConfig.fall,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.delay(pulseConfig.rest),
      ]),
    );

    animation.start();
    return () => {
      animation.stop();
    };
  }, [ledOn, pulseOpacity, shouldPulse, visualState]);

  return (
    <View pointerEvents="none" style={styles.overlayRoot}>
      <View
        style={[
          styles.ledOverlay,
          {
            top: 99 * scale,
            left: (TIMER_DIAL_VIEWBOX_SIZE / 2) * scale - 14 * scale,
            transform: [{ scale }],
          },
        ]}>
        <HardwareLed isOn={ledOn} size="medium" tone={ledTone} pulseOpacity={shouldPulse ? pulseOpacity : undefined} />
      </View>
      <View
        style={[
          styles.timeOverlay,
          {
            top: 148 * scale,
            left: (TIMER_DIAL_VIEWBOX_SIZE / 2) * scale - 67 * timeScale,
            transform: [{ scale: timeScale }],
          },
        ]}>
        <RollingCounter value={timeParts.minutes} digits={2} maxValue={99} noComma />
        <Text style={styles.timeColon}>:</Text>
        <RollingCounter value={timeParts.seconds} digits={2} maxValue={99} noComma />
      </View>
    </View>
  );
}

export const TimerDial = memo(function TimerDial({
  size = TIMER_DIAL_SIZE,
  progress,
  remainingTime,
  visualState,
}: TimerDialProps) {
  return (
    <View style={[styles.root, { width: size, height: size }]}>
      <TimerDialLayerStack size={size} from={0} to={4} />
      <StatusGlowOverlay size={size} visualState={visualState} />
      <ProgressTickRing size={size} progress={progress} visualState={visualState} />
      <TimerDialLayerStack size={size} from={4} to={6} />
      <RotatingTrianglePointer size={size} progress={progress} visualState={visualState} />
      <TimerDialCenterDisplay size={size} remainingTime={remainingTime} visualState={visualState} />
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    overflow: 'visible',
  },
  layerStack: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  layerImage: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
  },
  progressOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  statusGlowOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  pointerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  ledOverlay: {
    position: 'absolute',
    width: 28,
    height: 28,
  },
  timeOverlay: {
    position: 'absolute',
    width: 150,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    transformOrigin: 'center',
  },
  timeColon: {
    marginTop: -4,
    fontFamily: typography.meta.fontFamily,
    fontSize: 25,
    lineHeight: 30,
    color: colors.ink,
    opacity: 0.82,
    textShadowColor: 'rgba(255,255,255,0.58)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0.5,
  },
});
