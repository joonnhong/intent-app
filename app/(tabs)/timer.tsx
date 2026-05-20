import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Easing, InteractionManager, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, G, Line, LinearGradient as SvgLinearGradient, Polygon, RadialGradient as SvgRadialGradient, Stop } from 'react-native-svg';

import { CeramicButton } from '../../components/intent/CeramicButton';
import { HardwareLed } from '../../components/intent/HardwareLed';
import {
  applyPartialRewardAndFailure,
  applySuccess,
  calculateRewardPoints,
  getSoundEffectsEnabled,
  recordSession,
} from '../../services/storage';
import { colors, spacing, typography } from '../../constants/theme';

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

// ─── SVG Dial internals ────────────────────────────────────────────────────

const DIAL_VB   = 328;
const DIAL_HALF = DIAL_VB / 2;  // 164
const TICK_CX   = 127.5;        // tick ring local centre
const N_TICKS   = 60;

// G from react-native-svg lacks a `style` type declaration; cast so Animated can drive transforms.
const AnimatedSvgG = Animated.createAnimatedComponent(G as React.ComponentType<React.PropsWithChildren<{ style?: object }>>);

// ─── Timer display bars ───────────────────────────────────────────────────

// Figma layer 14 specifies four quiet display bars, each 24×57px.
const TIMER_CELL_W = 24;
const TIMER_CELL_H = 57;

const timerDigitStyles = StyleSheet.create({
  displayBar: {
    width: TIMER_CELL_W,
    height: TIMER_CELL_H,
    backgroundColor: '#D9D9D9',
    opacity: 0.76,
  },
});

function TimerDisplayBar({ scale }: { scale: number }) {
  return (
    <View
      importantForAccessibility="no"
      style={[
        timerDigitStyles.displayBar,
        {
          width: TIMER_CELL_W * scale,
          height: TIMER_CELL_H * scale,
        },
      ]}
    />
  );
}

type DialTone = 'neutral' | 'green' | 'red';

const TICK_TONE: Record<DialTone, string> = {
  neutral: 'rgba(102,107,103,0.55)',
  green:   'rgb(74,139,38)',
  red:     'rgb(200,90,55)',
};

function DialTickMarks({ tone }: { tone: DialTone }) {
  const stroke = TICK_TONE[tone];
  const marks = useMemo(() => {
    const out: React.ReactElement[] = [];
    const OUTER = 122, INNER = 102;
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * 2 * Math.PI - Math.PI / 2;
      const major = i % 5 === 0;
      const len = major ? 11 : 6;
      const w   = major ? 1.4 : 1.0;
      out.push(<Line key={`o${i}`}
        x1={TICK_CX + Math.cos(a) * (OUTER - len)} y1={TICK_CX + Math.sin(a) * (OUTER - len)}
        x2={TICK_CX + Math.cos(a) * OUTER}         y2={TICK_CX + Math.sin(a) * OUTER}
        stroke={stroke} strokeWidth={w} strokeLinecap="round" />);
    }
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * 2 * Math.PI - Math.PI / 2;
      const len = i % 2 === 0 ? 5 : 3;
      out.push(<Line key={`i${i}`}
        x1={TICK_CX + Math.cos(a) * (INNER - len)} y1={TICK_CX + Math.sin(a) * (INNER - len)}
        x2={TICK_CX + Math.cos(a) * INNER}         y2={TICK_CX + Math.sin(a) * INNER}
        stroke={stroke} strokeWidth={0.6} strokeLinecap="round" opacity={0.75} />);
    }
    return out;
  }, [stroke]);
  return <G>{marks}</G>;
}

type HardwareTimerDialProps = {
  size?: number;
  remainingSeconds: number;
  durationSeconds: number;
  status: 'loading' | 'running' | 'success' | 'ended';
  isWarning: boolean;
};

const HardwareTimerDial = memo(function HardwareTimerDial({
  size = 320,
  remainingSeconds,
  durationSeconds,
  status,
  isWarning,
}: HardwareTimerDialProps) {
  const isComplete = status === 'success';
  const isFailed   = status === 'ended';
  const isRunning  = status === 'running';

  const elapsed   = Math.max(0, durationSeconds - remainingSeconds);
  const progress  = durationSeconds > 0 ? Math.min(1, elapsed / durationSeconds) : 0;
  const tickStep  = Math.floor(progress * N_TICKS + 1e-6);
  const targetRot = -(tickStep / N_TICKS) * 360;  // counter-clockwise

  const rot = useRef(new Animated.Value(targetRot)).current;
  useEffect(() => {
    Animated.timing(rot, {
      toValue: targetRot,
      duration: 220,
      easing: Easing.bezier(0.45, 1.6, 0.55, 1),
      useNativeDriver: true,
    }).start();
  }, [targetRot, rot]);

  const animRotStr = rot.interpolate({ inputRange: [-720, 720], outputRange: ['-720deg', '720deg'] });

  const tone: DialTone = isComplete ? 'green' : (isFailed || isWarning) ? 'red' : 'neutral';
  type LedTone = 'off' | 'amber' | 'green' | 'red';
  const ledTone: LedTone = isComplete ? 'green' : isFailed ? 'red' : isWarning ? 'red' : isRunning ? 'amber' : 'off';

  const [blink, setBlink] = useState(true);
  useEffect(() => {
    if (isRunning && !isWarning) {
      const id = setInterval(() => setBlink(b => !b), 900);
      return () => clearInterval(id);
    }
    if (isWarning || isFailed) {
      const id = setInterval(() => setBlink(b => !b), 340);
      return () => clearInterval(id);
    }
    setBlink(true);
  }, [isRunning, isWarning, isFailed]);

  const LED_CORE: Record<LedTone, string> = { off: '#432323', amber: '#FFA028', green: '#50DC50', red: '#F88181' };
  const LED_EDGE: Record<LedTone, string> = { off: 'rgba(0,0,0,0.4)', amber: '#FFC86E', green: '#8CF08C', red: '#FF8B8B' };
  const ledOpacity = (ledTone === 'off' || blink) ? 1 : 0.35;

  const grooveFill = tone === 'green' ? 'rgba(80,180,60,0.35)' : tone === 'red' ? 'rgba(200,80,60,0.35)' : 'rgba(102,102,102,0.40)';
  const grooveStroke = tone === 'green' ? 'rgba(80,200,60,0.7)' : tone === 'red' ? 'rgba(220,100,80,0.7)' : 'rgba(17,19,18,0.55)';
  const triColor = isComplete ? 'rgb(74,139,38)' : (isFailed || isWarning) ? 'rgb(200,80,55)' : isRunning ? 'rgb(255,140,40)' : 'rgba(102,107,103,0.5)';

  const showSecs = isComplete ? 0 : remainingSeconds;
  const mm = Math.floor(showSecs / 60).toString().padStart(2, '0');
  const ss = (Math.floor(showSecs) % 60).toString().padStart(2, '0');

  const H = DIAL_HALF;
  const scale = size / DIAL_VB;
  const markerTop = H - 107 + 3;
  const markerTip = markerTop + 11.4;
  const ledCy = H - 79 + 28;
  const digitRowTop = Math.round(((H - 79 + 50.5) / DIAL_VB) * size);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${DIAL_VB} ${DIAL_VB}`}>
        <Defs>
          <SvgLinearGradient id="dtRecess" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%"   stopColor="#DEDAD0" />
            <Stop offset="100%" stopColor="#F6F3EC" />
          </SvgLinearGradient>
          <SvgLinearGradient id="dtBvL" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%"   stopColor="#FFFCF6" />
            <Stop offset="100%" stopColor="#DEDAD0" />
          </SvgLinearGradient>
          <SvgLinearGradient id="dtBvD" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%"   stopColor="#DEDAD0" />
            <Stop offset="100%" stopColor="#FFFCF6" />
          </SvgLinearGradient>
          {/* Top inset shadow: matches CSS "inset 0 4px 8px rgba(0,0,0,0.15)" —
              visible only in the top ~8% of the circle, then transparent.
              Applied as fill overlays so there are no stroke-band edges. */}
          <SvgLinearGradient id="dtShadTop" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%"  stopColor="rgba(0,0,0,0.00)" />
            <Stop offset="2%"  stopColor="rgba(0,0,0,0.14)" />
            <Stop offset="8%"  stopColor="rgba(0,0,0,0.04)" />
            <Stop offset="12%" stopColor="rgba(0,0,0,0.00)" />
            <Stop offset="100%" stopColor="rgba(0,0,0,0.00)" />
          </SvgLinearGradient>
          {/* Bottom specular: matches CSS "inset 0 -2px 4px rgba(255,255,255,0.6)" —
              visible only in the bottom ~6% of the circle. */}
          <SvgLinearGradient id="dtSpecLo" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%"  stopColor="rgba(255,255,255,0.00)" />
            <Stop offset="92%" stopColor="rgba(255,255,255,0.00)" />
            <Stop offset="97%" stopColor="rgba(255,255,255,0.40)" />
            <Stop offset="100%" stopColor="rgba(255,255,255,0.35)" />
          </SvgLinearGradient>
          {/* Bottom cast shadow: simulates CSS "0 8px Npx rgba(0,0,0,0.X)" drop-shadow
              from a raised disc pooling at the lower portion of the surface below it.
              Visible only in the bottom ~15% of each receiving circle. */}
          <SvgLinearGradient id="dtShadBot" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%"   stopColor="rgba(0,0,0,0.00)" />
            <Stop offset="80%"  stopColor="rgba(0,0,0,0.00)" />
            <Stop offset="91%"  stopColor="rgba(0,0,0,0.13)" />
            <Stop offset="100%" stopColor="rgba(0,0,0,0.10)" />
          </SvgLinearGradient>
          <SvgRadialGradient id="dtGlowG" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#55FF55" stopOpacity="0.55" />
            <Stop offset="100%" stopColor="#55FF55" stopOpacity="0" />
          </SvgRadialGradient>
          <SvgRadialGradient id="dtGlowR" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#FF2222" stopOpacity="0.55" />
            <Stop offset="100%" stopColor="#FF2222" stopOpacity="0" />
          </SvgRadialGradient>
          <SvgRadialGradient id="dtGlowA" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#FF9020" stopOpacity="0.55" />
            <Stop offset="100%" stopColor="#FF9020" stopOpacity="0" />
          </SvgRadialGradient>
        </Defs>

        {/* ── Concentric depth rings ──────────────────────────────────────────────
             Fill-overlay technique: shadow/specular gradients are drawn as filled
             circles. Inner circles cover the center, leaving only the narrow annular
             zone visible. Because it's a fill gradient (no stroke width), there are
             no hard ring edges — the shadow fades exactly like CSS inset box-shadow.

             Gradient stop positions match the CSS reference:
               dtShadTop: fades out by 12% (≈ inset 0 4px 8px rgba(0,0,0,0.15))
               dtSpecLo:  starts at 92%  (≈ inset 0 -2px 4px rgba(255,255,255,0.6))

             Raised discs carry a thin stroke (strokeWidth≈1.5) matching the
             reference's "0 0 2px rgba(0,0,0,0.6)" crisp-edge outline. */}

        {/* Recessed well */}
        <Circle cx={H} cy={H} r={164} fill="url(#dtRecess)" />
        <Circle cx={H} cy={H} r={164} fill="url(#dtShadTop)" />
        <Circle cx={H} cy={H} r={164} fill="url(#dtShadBot)" opacity={0.22} />
        <Circle cx={H} cy={H} r={164} fill="url(#dtSpecLo)" />

        {/* Raised outer bevel — bright-top → dark-bottom + thin edge.
            Figma: shadow 0 0 2px rgba(0,0,0,0.6) + 0 4px 4px rgba(0,0,0,0.15) */}
        <Circle cx={H} cy={H} r={158}
          fill="url(#dtBvL)"
          stroke="rgba(0,0,0,0.52)" strokeWidth={1.5} />
        <Circle cx={H} cy={H} r={158} fill="url(#dtShadTop)" />
        <Circle cx={H} cy={H} r={158} fill="url(#dtSpecLo)" />

        {/* Flat surface */}
        <Circle cx={H} cy={H} r={152} fill="#F0EEE9" />

        {/* Inner bevel dark (recessed groove edge) */}
        <Circle cx={H} cy={H} r={152} fill="url(#dtShadTop)" opacity={0.55} />
        <Circle cx={H} cy={H} r={144} fill="url(#dtBvD)" />
        <Circle cx={H} cy={H} r={144} fill="url(#dtSpecLo)" />

        {/* Groove ring — glows on complete/failed.
            Figma: fill rgba(102,102,102,0.4), inset shadow 0 4px 4px rgba(17,19,18,0.1) + inset 0 0 2.1px rgba(17,19,18,0.8) */}
        <Circle cx={H} cy={H} r={138} fill={grooveFill} stroke={grooveStroke} strokeWidth={2} />
        <Circle cx={H} cy={H} r={138} fill="url(#dtShadTop)" />
        <Circle cx={H} cy={H} r={138} fill="url(#dtShadBot)" opacity={0.22} />
        {tone !== 'neutral' && (
          <Circle cx={H} cy={H} r={136} fill="none"
            stroke={tone === 'green' ? 'rgba(60,200,60,0.30)' : 'rgba(220,70,50,0.28)'}
            strokeWidth={3} />
        )}

        {/* Inner button background disc — raised above groove.
            Figma: bg #f0eee9, shadow 0 0 4.1px rgba(0,0,0,0.6) + 0 8px 8px rgba(0,0,0,0.25) */}
        <Circle cx={H} cy={H} r={130} fill="#F0EEE9"
          stroke="rgba(0,0,0,0.40)" strokeWidth={1.5} />
        <Circle cx={H} cy={H} r={130} fill="url(#dtShadTop)" opacity={0.6} />
        <Circle cx={H} cy={H} r={130} fill="url(#dtSpecLo)" />

        {/* Tick ring — rotates counter-clockwise as session progresses */}
        <AnimatedSvgG style={{ transform: [{ translateX: H - TICK_CX }, { translateY: H - TICK_CX }] }}>
          <AnimatedSvgG style={{ transform: [
            { translateX: TICK_CX }, { translateY: TICK_CX },
            { rotate: animRotStr },
            { translateX: -TICK_CX }, { translateY: -TICK_CX },
          ] }}>
            <DialTickMarks tone={tone} />
          </AnimatedSvgG>
        </AnimatedSvgG>

        {/* Inner raised bevel + dial face.
            Figma: drop-shadow 0 0 1px rgba(0,0,0,0.6) + 0 8px 4px rgba(0,0,0,0.15) */}
        <Circle cx={H} cy={H} r={113}
          fill="url(#dtBvL)"
          stroke="rgba(0,0,0,0.50)" strokeWidth={1.5} />
        <Circle cx={H} cy={H} r={113} fill="url(#dtShadTop)" />
        <Circle cx={H} cy={H} r={113} fill="url(#dtSpecLo)" />
        <Circle cx={H} cy={H} r={107} fill="#F0EEE9" />

        {/* Index triangle — 12 o'clock marker, inside inner disc.
            Figma: top=3, h=11.4 within the 214px inner disc. */}
        <Polygon
          points={`${H-5},${markerTop} ${H+5},${markerTop} ${H},${markerTip}`}
          fill={triColor}
          stroke="rgba(0,0,0,0.15)"
          strokeWidth={0.3}
        />

        {/* Inner disc surface */}
        <Circle cx={H} cy={H} r={107} fill="url(#dtShadTop)" opacity={0.5} />
        <Circle cx={H} cy={H} r={107} fill="url(#dtShadBot)" opacity={0.18} />
        <Circle cx={H} cy={H} r={91} fill="url(#dtBvD)" />
        <Circle cx={H} cy={H} r={91} fill="url(#dtSpecLo)" />

        {/* Glass bevel — raised, bright-top → dark-bottom + edge.
            Figma: drop-shadow 0 0 1px rgba(0,0,0,0.6) + 0 4px 2px rgba(0,0,0,0.15) */}
        <Circle cx={H} cy={H} r={85}
          fill="url(#dtBvL)"
          stroke="rgba(0,0,0,0.48)" strokeWidth={1.2} />
        <Circle cx={H} cy={H} r={85} fill="url(#dtShadTop)" />
        <Circle cx={H} cy={H} r={85} fill="url(#dtSpecLo)" />

        {/* Glass surface */}
        <Circle cx={H} cy={H} r={79} fill="#F0EEE9" />
        <Circle cx={H} cy={H} r={79} fill="url(#dtShadTop)" opacity={0.40} />
        <Circle cx={H} cy={H} r={79} fill="url(#dtShadBot)" opacity={0.15} />

        {/* Status LED — Figma: center (79,28) inside the 158px glass surface. */}
        {ledTone !== 'off' && (
          <Circle cx={H} cy={ledCy} r={7}
            fill={ledTone === 'green' ? 'url(#dtGlowG)' : ledTone === 'red' ? 'url(#dtGlowR)' : 'url(#dtGlowA)'}
            opacity={blink ? 0.7 : 0.2} />
        )}
        <Circle cx={H} cy={ledCy} r={4}
          fill={LED_CORE[ledTone]}
          stroke={LED_EDGE[ledTone]}
          strokeWidth={0.5}
          opacity={ledOpacity} />

      </Svg>

      {/* Display bars — two MM / SS groups matching Figma layer 14. */}
      <View
        style={[StyleSheet.absoluteFill, { alignItems: 'center' }]}
        accessibilityLabel={`Remaining time ${mm}:${ss}`}
        pointerEvents="none">
        <View style={{
          position: 'absolute',
          top: digitRowTop,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12 * scale,
        }}>
          <View style={{ flexDirection: 'row', gap: 8 * scale }}>
            <TimerDisplayBar scale={scale} />
            <TimerDisplayBar scale={scale} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 * scale }}>
            <TimerDisplayBar scale={scale} />
            <TimerDisplayBar scale={scale} />
          </View>
        </View>
      </View>
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
  const countdownDurationSeconds = Math.max(1, countdownDurationSecondsRef.current);
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
              <HardwareTimerDial
                size={326}
                remainingSeconds={remainingSeconds}
                durationSeconds={countdownDurationSeconds}
                status={status}
                isWarning={isWarning}
              />
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
    height: 338,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
});



































