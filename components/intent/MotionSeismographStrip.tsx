import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, {
  Defs,
  Line,
  LinearGradient as SvgLinearGradient,
  Polyline,
  Rect,
  Stop,
} from 'react-native-svg';

const NEEDLE_IMAGE = require('../../assets/instruments/movement-needle.png');

const STRIP_WIDTH = 344;
const STRIP_HEIGHT = 46;
const SAMPLE_COUNT = 128;
const SEAT_PADDING = 3;
const TRACE_PADDING_X = 9;
const TRACE_PADDING_Y = 7;
const NEEDLE_IMAGE_WIDTH = 50;
const NEEDLE_IMAGE_HEIGHT = NEEDLE_IMAGE_WIDTH / (284 / 36);
const NEEDLE_RIGHT_INSET = -4;
const NEEDLE_PIVOT_Y = STRIP_HEIGHT / 2;
const NEEDLE_MAX_ROTATION_DEG = 13;
const STYLUS_TIP_X = STRIP_WIDTH - NEEDLE_RIGHT_INSET - NEEDLE_IMAGE_WIDTH;
const TRACE_NEEDLE_INSET = 6;
const TRACE_ORIGIN_X = STYLUS_TIP_X + TRACE_NEEDLE_INSET;
const GRID_VERTICAL_COUNT = 16;
const GRID_HORIZONTAL_COUNT = 9;
const GRID_HORIZONTAL_INSET = 18;
const GRID_VERTICAL_SPACING = (STRIP_WIDTH - GRID_HORIZONTAL_INSET * 2) / (GRID_VERTICAL_COUNT - 1);
const TRACE_SAMPLE_SPACING = (TRACE_ORIGIN_X - TRACE_PADDING_X) / (SAMPLE_COUNT - 1);
const GRID_SCROLL_STEP = TRACE_SAMPLE_SPACING;

type MotionSeismographStripProps = {
  movementLevel: number;
  isActive: boolean;
  isWarning: boolean;
  resetKey?: string;
};

function createBaselineSamples() {
  return Array.from({ length: SAMPLE_COUNT }, (_, index) => {
    const phase = index / SAMPLE_COUNT;
    return Math.sin(phase * Math.PI * 5) * 0.018;
  });
}

function createTracePoints(samples: number[]) {
  const width = TRACE_ORIGIN_X - TRACE_PADDING_X;
  const step = width / Math.max(1, samples.length - 1);

  return samples
    .map((sample, index) => {
      const x = TRACE_PADDING_X + step * index;
      const y = getTraceY(sample);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function getTraceY(sample: number) {
  const height = STRIP_HEIGHT - TRACE_PADDING_Y * 2;
  const centerY = STRIP_HEIGHT / 2;
  return centerY - Math.max(-1, Math.min(1, sample)) * height * 0.46;
}

export function MotionSeismographStrip({
  movementLevel,
  isActive,
  isWarning,
  resetKey,
}: MotionSeismographStripProps) {
  const [samples, setSamples] = useState(createBaselineSamples);
  const [hasRecorded, setHasRecorded] = useState(false);
  const movementLevelRef = useRef(movementLevel);
  const motionEnergyRef = useRef(0);
  const tracePhaseRef = useRef(0);
  const [gridOffset, setGridOffset] = useState(0);

  useEffect(() => {
    movementLevelRef.current = movementLevel;
  }, [movementLevel]);

  useEffect(() => {
    setSamples(createBaselineSamples());
    setHasRecorded(false);
    setGridOffset(0);
    motionEnergyRef.current = 0;
    tracePhaseRef.current = 0;
  }, [resetKey]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    setHasRecorded(true);

    const intervalId = setInterval(() => {
      const level = movementLevelRef.current;
      motionEnergyRef.current = Math.max(level, motionEnergyRef.current * 0.86);
      tracePhaseRef.current += 0.52 + motionEnergyRef.current * 0.38;

      const energy = motionEnergyRef.current;
      setGridOffset((currentOffset) => (
        currentOffset + GRID_SCROLL_STEP
      ) % GRID_VERTICAL_SPACING);

      const idleJitter = (Math.random() - 0.5) * 0.055;
      const oscillation = Math.sin(tracePhaseRef.current) * energy * 0.34;
      const movementJitter = energy > 0.035 ? (Math.random() - 0.5) * (0.46 + energy * 1.95) : 0;
      const impulse = level > 0.38 && Math.random() > 0.62
        ? (Math.random() > 0.5 ? 1 : -1) * Math.min(0.92, 0.26 + level * 0.86)
        : 0;

      setSamples((currentSamples) => {
        const previousSample = currentSamples[currentSamples.length - 1] ?? 0;
        const targetSample = Math.max(-1, Math.min(1, idleJitter + oscillation + movementJitter + impulse));
        const nextSample = Math.max(-1, Math.min(1, previousSample * 0.22 + targetSample * 0.78));
        return [...currentSamples.slice(1), nextSample];
      });
    }, 110);

    return () => clearInterval(intervalId);
  }, [isActive]);

  const traceColor = isWarning ? '#D83A2E' : '#C9332A';
  const glowOpacity = isWarning ? 0.22 : 0.1;
  const tracePoints = createTracePoints(samples);
  const stylusTipY = getTraceY(samples[samples.length - 1] ?? 0);
  const needleTop = SEAT_PADDING + NEEDLE_PIVOT_Y - NEEDLE_IMAGE_HEIGHT / 2;
  const rawNeedleAngle = Math.asin(
    Math.max(-1, Math.min(1, (NEEDLE_PIVOT_Y - stylusTipY) / NEEDLE_IMAGE_WIDTH))
  ) * (180 / Math.PI);
  const needleAngle = Math.max(
    -NEEDLE_MAX_ROTATION_DEG,
    Math.min(NEEDLE_MAX_ROTATION_DEG, rawNeedleAngle)
  );
  const shouldShowRecordedTrace = isActive || hasRecorded;

  return (
    <View pointerEvents="none" style={styles.root}>
      <LinearGradient
        colors={['#DEDAD0', '#FDFAF5']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.seat}>
        <View style={styles.contactGap} />
        <View style={styles.paperTrack}>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(17,19,18,0.055)', 'rgba(17,19,18,0.018)', 'rgba(246,243,236,0.05)', 'rgba(17,19,18,0)']}
            locations={[0, 0.38, 0.68, 1]}
            style={styles.trackTopShade}
          />
          <Svg width={STRIP_WIDTH} height={STRIP_HEIGHT}>
            <Defs>
              <SvgLinearGradient id="paperSheen" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0%" stopColor="#FBF8F1" stopOpacity="0.96" />
                <Stop offset="46%" stopColor="#FFFDF8" stopOpacity="1" />
                <Stop offset="100%" stopColor="#F6F1E8" stopOpacity="0.98" />
              </SvgLinearGradient>
              <SvgLinearGradient id="topTraceHaze" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#111312" stopOpacity="0.055" />
                <Stop offset="34%" stopColor={traceColor} stopOpacity={glowOpacity * 0.48} />
                <Stop offset="72%" stopColor={traceColor} stopOpacity={glowOpacity * 0.18} />
                <Stop offset="100%" stopColor={traceColor} stopOpacity="0" />
              </SvgLinearGradient>
            </Defs>
            <Rect x="1" y="1" width={STRIP_WIDTH - 2} height={STRIP_HEIGHT - 2} rx="10" fill="url(#paperSheen)" />
            {Array.from({ length: GRID_VERTICAL_COUNT + 2 }, (_, index) => (
              <Line
                key={`motion-v-${index}`}
                x1={GRID_HORIZONTAL_INSET - GRID_VERTICAL_SPACING + index * GRID_VERTICAL_SPACING - gridOffset}
                x2={GRID_HORIZONTAL_INSET - GRID_VERTICAL_SPACING + index * GRID_VERTICAL_SPACING - gridOffset}
                y1="7"
                y2={STRIP_HEIGHT - 7}
                stroke="#5F7394"
                strokeOpacity="0.24"
                strokeWidth="0.75"
              />
            ))}
            {Array.from({ length: GRID_HORIZONTAL_COUNT }, (_, index) => {
              const y = 7 + index * ((STRIP_HEIGHT - 14) / (GRID_HORIZONTAL_COUNT - 1));
              const isCenterLine = index === Math.floor(GRID_HORIZONTAL_COUNT / 2);
              return (
              <Line
                key={`motion-h-${index}`}
                x1="8"
                x2={STRIP_WIDTH - 8}
                y1={y}
                y2={y}
                stroke="#5F7394"
                strokeOpacity={isCenterLine ? 0.34 : 0.18}
                strokeWidth={isCenterLine ? 0.95 : 0.6}
              />
              );
            })}
            <Rect x="3" y="2" width={STRIP_WIDTH - 6} height="18" rx="8" fill="url(#topTraceHaze)" />
            <Polyline
              points={tracePoints}
              fill="none"
              stroke={traceColor}
              strokeOpacity={shouldShowRecordedTrace ? 0.22 : 0.1}
              strokeWidth="4.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Polyline
              points={tracePoints}
              fill="none"
              stroke={traceColor}
              strokeOpacity={shouldShowRecordedTrace ? 0.88 : 0.28}
              strokeWidth="1.35"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.bottomGlint}
          />
        </View>
        <Image
          source={NEEDLE_IMAGE}
          resizeMode="contain"
          style={[
            styles.needleShadow,
            {
              top: needleTop + 2,
              transform: [
                { translateX: NEEDLE_IMAGE_WIDTH / 2 },
                { rotate: `${needleAngle}deg` },
                { translateX: -NEEDLE_IMAGE_WIDTH / 2 },
              ],
            },
          ]}
        />
        <Image
          source={NEEDLE_IMAGE}
          resizeMode="contain"
          style={[
            styles.needleImage,
            {
              top: needleTop,
              transform: [
                { translateX: NEEDLE_IMAGE_WIDTH / 2 },
                { rotate: `${needleAngle}deg` },
                { translateX: -NEEDLE_IMAGE_WIDTH / 2 },
              ],
            },
          ]}
        />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    height: 52,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 30,
  },
  seat: {
    width: STRIP_WIDTH,
    height: STRIP_HEIGHT,
    borderRadius: 14,
    padding: SEAT_PADDING,
    position: 'relative',
  },
  contactGap: {
    position: 'absolute',
    top: 3,
    right: 3,
    bottom: 3,
    left: 3,
    borderRadius: 11,
    backgroundColor: 'rgba(17,19,18,0.045)',
    shadowColor: '#111312',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  paperTrack: {
    flex: 1,
    borderRadius: 11,
    overflow: 'hidden',
    backgroundColor: '#FFFDF8',
    position: 'relative',
  },
  trackTopShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: 17,
    zIndex: 2,
  },
  bottomGlint: {
    position: 'absolute',
    right: 8,
    bottom: 1,
    left: 8,
    height: 1,
  },
  needleImage: {
    position: 'absolute',
    right: NEEDLE_RIGHT_INSET - SEAT_PADDING,
    width: NEEDLE_IMAGE_WIDTH,
    height: NEEDLE_IMAGE_HEIGHT,
    zIndex: 6,
  },
  needleShadow: {
    position: 'absolute',
    right: NEEDLE_RIGHT_INSET - SEAT_PADDING + 1,
    width: NEEDLE_IMAGE_WIDTH,
    height: NEEDLE_IMAGE_HEIGHT,
    opacity: 0.22,
    tintColor: '#111312',
    zIndex: 5,
  },
});
