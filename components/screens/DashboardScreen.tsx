import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Defs, FeGaussianBlur, FeMerge, FeMergeNode, Filter, G, LinearGradient as SvgGradient, Rect as SvgRect, Stop, Svg, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getSessionHistory, getStats, type SessionRecord } from '../../services/storage';
import { formatPlainDuration } from '../intent/format';
import { HardwareLed } from '../intent/HardwareLed';
import { RollingCounter } from '../intent/RollingCounter';
import { colors, spacing, typography } from '../../constants/theme';

// ─── Constants ───────────────────────────────────────────────────────────────

const PANEL_RADIUS = 22;
const PANEL_GAP_INSET = 4;
const PANEL_GAP_RADIUS = PANEL_RADIUS - 2;
const PANEL_INNER_INSET = 6;
const PANEL_INNER_RADIUS = PANEL_RADIUS - 4;
const SEGMENT_COUNT = 10;
const SEGMENT_H = 5;
const SEGMENT_GAP = 3;
const COL_GAP = 5;
const CHART_COL_H = SEGMENT_COUNT * SEGMENT_H + (SEGMENT_COUNT - 1) * SEGMENT_GAP; // 77px
const CHART_LABEL_H = 16;
const SVG_H = CHART_COL_H + CHART_LABEL_H; // 93px

// ─── Helpers ─────────────────────────────────────────────────────────────────

function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

type DayStats = {
  dateKey: string;
  dayLabel: string;
  isToday: boolean;
  focusSeconds: number;
  sessionCount: number;
  points: number;
};

function buildWeekData(history: SessionRecord[]): DayStats[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateKey = localDateString(d);
    const daySessions = history.filter(s => localDateString(new Date(s.date)) === dateKey);
    return {
      dateKey,
      dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3),
      isToday: i === 6,
      focusSeconds: daySessions.reduce((sum, s) => sum + s.completedSeconds, 0),
      sessionCount: daySessions.length,
      points: daySessions.reduce((sum, s) => sum + s.pointsEarned, 0),
    };
  });
}

function formatFocusTime(seconds: number): string {
  return seconds > 0 ? formatPlainDuration(seconds) : '0m';
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const [totalPoints, setTotalPoints] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [history, setHistory] = useState<SessionRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      Promise.all([getStats(), getSessionHistory()]).then(([stats, sessions]) => {
        if (isActive) {
          setTotalPoints(stats.totalPoints);
          setCurrentStreak(stats.currentStreak);
          setHistory(sessions);
        }
      });
      return () => { isActive = false; };
    }, [])
  );

  const { width: screenWidth } = useWindowDimensions();
  // spacing.lg(16)*2 + PANEL_INNER_INSET(6)*2 + panelField paddingHorizontal(14)*2 = 72
  const chartWidth = Math.max(100, screenWidth - 72);
  const colWidth = (chartWidth - 6 * COL_GAP) / 7;

  const weekData = useMemo(() => buildWeekData(history), [history]);
  const maxFocusSeconds = useMemo(() => Math.max(...weekData.map(d => d.focusSeconds), 1), [weekData]);

  const today = weekData[6];
  const yesterday = weekData[5];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoWrapper}>
            <Text style={styles.logoBevel} numberOfLines={1} importantForAccessibility="no">Dashboard</Text>
            <Text style={styles.logo} numberOfLines={1}>Dashboard</Text>
          </View>
          <HardwareLed size="medium" tone="orange" />
        </View>

        {/* Metrics */}
        <View style={styles.metricsCol}>
          <MetricCard label="Points today">
            <RollingCounter value={today.points} digits={5} />
          </MetricCard>
          <MetricCard label="Day streak">
            <RollingCounter value={currentStreak} digits={5} maxValue={99999} />
          </MetricCard>
        </View>

        {/* 7-day bar chart */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow} numberOfLines={1}>7-Day Focus</Text>
          <RecessedPanel>
            <View style={styles.chartArea}>
              <Svg width={chartWidth} height={SVG_H}>
                <Defs>
                  {/* Bevel gradients — objectBoundingBox so they apply per-rect */}
                  <SvgGradient id="gUnlit" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%"   stopColor="#111312" stopOpacity="0.11" />
                    <Stop offset="22%"  stopColor="#111312" stopOpacity="0.02" />
                    <Stop offset="100%" stopColor="#111312" stopOpacity="0.04" />
                  </SvgGradient>

                  <SvgGradient id="gLitToday" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%"   stopColor="#72C47C" stopOpacity="1" />
                    <Stop offset="38%"  stopColor="#3E7048" stopOpacity="1" />
                    <Stop offset="100%" stopColor="#244030" stopOpacity="1" />
                  </SvgGradient>

                  <SvgGradient id="gPeakToday" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%"   stopColor="#C8F0CE" stopOpacity="1" />
                    <Stop offset="32%"  stopColor="#80D48A" stopOpacity="1" />
                    <Stop offset="100%" stopColor="#3C6A46" stopOpacity="1" />
                  </SvgGradient>

                  <SvgGradient id="gLitPast" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%"   stopColor="#C4B07A" stopOpacity="0.72" />
                    <Stop offset="38%"  stopColor="#8A7A52" stopOpacity="0.52" />
                    <Stop offset="100%" stopColor="#524830" stopOpacity="0.36" />
                  </SvgGradient>

                  <SvgGradient id="gPeakPast" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%"   stopColor="#EED89A" stopOpacity="0.95" />
                    <Stop offset="32%"  stopColor="#C0A862" stopOpacity="0.80" />
                    <Stop offset="100%" stopColor="#7A6438" stopOpacity="0.60" />
                  </SvgGradient>

                  {/* Glow filters */}
                  <Filter id="fLitToday" x="-50%" y="-50%" width="200%" height="200%">
                    <FeGaussianBlur in="SourceGraphic" stdDeviation="1.4" result="blur" />
                    <FeMerge><FeMergeNode in="blur" /><FeMergeNode in="SourceGraphic" /></FeMerge>
                  </Filter>
                  <Filter id="fPeakToday" x="-80%" y="-80%" width="260%" height="260%">
                    <FeGaussianBlur in="SourceGraphic" stdDeviation="3.0" result="blur" />
                    <FeMerge><FeMergeNode in="blur" /><FeMergeNode in="SourceGraphic" /></FeMerge>
                  </Filter>
                  <Filter id="fLitPast" x="-50%" y="-50%" width="200%" height="200%">
                    <FeGaussianBlur in="SourceGraphic" stdDeviation="1.0" result="blur" />
                    <FeMerge><FeMergeNode in="blur" /><FeMergeNode in="SourceGraphic" /></FeMerge>
                  </Filter>
                  <Filter id="fPeakPast" x="-80%" y="-80%" width="260%" height="260%">
                    <FeGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur" />
                    <FeMerge><FeMergeNode in="blur" /><FeMergeNode in="SourceGraphic" /></FeMerge>
                  </Filter>
                </Defs>

                {weekData.map((day, colIdx) => {
                  const cx = colIdx * (colWidth + COL_GAP);
                  const litCount = day.focusSeconds > 0
                    ? Math.max(1, Math.round((day.focusSeconds / maxFocusSeconds) * SEGMENT_COUNT))
                    : 0;
                  return (
                    <G key={day.dateKey}>
                      {Array.from({ length: SEGMENT_COUNT }, (_, i) => {
                        const fromBottom = SEGMENT_COUNT - 1 - i;
                        const isLit = fromBottom < litCount;
                        const isPeak = fromBottom === litCount - 1;
                        const sy = i * (SEGMENT_H + SEGMENT_GAP);
                        const gradId = !isLit ? 'gUnlit'
                          : isPeak ? (day.isToday ? 'gPeakToday' : 'gPeakPast')
                          : (day.isToday ? 'gLitToday' : 'gLitPast');
                        const filterId = !isLit ? undefined
                          : isPeak ? (day.isToday ? 'fPeakToday' : 'fPeakPast')
                          : (day.isToday ? 'fLitToday' : 'fLitPast');
                        return (
                          <G key={i} filter={filterId ? `url(#${filterId})` : undefined}>
                            <SvgRect
                              x={cx} y={sy}
                              width={colWidth} height={SEGMENT_H}
                              rx={2.5}
                              fill={`url(#${gradId})`}
                            />
                            {/* Specular top-edge highlight */}
                            <SvgRect
                              x={cx + 1.5} y={sy + 0.5}
                              width={colWidth - 3} height={1.5}
                              rx={1.5}
                              fill="white"
                              opacity={isLit ? (isPeak ? 0.55 : 0.28) : 0.18}
                            />
                          </G>
                        );
                      })}
                      {/* Day label */}
                      <SvgText
                        x={cx + colWidth / 2}
                        y={CHART_COL_H + CHART_LABEL_H - 2}
                        textAnchor="middle"
                        fontSize={9}
                        fontFamily={typography.meta.fontFamily}
                        fill={day.isToday ? colors.sage : 'rgba(17,19,18,0.38)'}
                        fontWeight={day.isToday ? '600' : '400'}
                      >
                        {day.dayLabel}
                      </SvgText>
                    </G>
                  );
                })}
              </Svg>
            </View>
          </RecessedPanel>
        </View>

        {/* Daily comparison */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow} numberOfLines={1}>Daily Comparison</Text>
          <RecessedPanel>
            <View style={styles.compHeaderRow}>
              <Text style={styles.compRowLabel} />
              <Text style={styles.compColHeader} numberOfLines={1}>Yesterday</Text>
              <Text style={styles.compColHeader} numberOfLines={1}>Today</Text>
            </View>
            <CompDivider />
            {[
              {
                label: 'Focus time',
                todayVal: formatFocusTime(today.focusSeconds),
                yestVal: formatFocusTime(yesterday.focusSeconds),
                compare: today.focusSeconds - yesterday.focusSeconds,
              },
              {
                label: 'Sessions',
                todayVal: String(today.sessionCount),
                yestVal: String(yesterday.sessionCount),
                compare: today.sessionCount - yesterday.sessionCount,
              },
              {
                label: 'Points',
                todayVal: today.points > 0 ? `+${today.points}` : '0',
                yestVal: yesterday.points > 0 ? `+${yesterday.points}` : '0',
                compare: today.points - yesterday.points,
              },
            ].map((row, i, arr) => (
              <Fragment key={row.label}>
                <View style={styles.compRow}>
                  <Text style={styles.compRowLabel} numberOfLines={1}>{row.label}</Text>
                  <Text style={styles.compValueMuted} numberOfLines={1}>{row.yestVal}</Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.compValue,
                      row.compare > 0 && styles.compValueUp,
                      row.compare < 0 && styles.compValueDown,
                    ]}>
                    {row.todayVal}
                  </Text>
                </View>
                {i < arr.length - 1 && <CompDivider />}
              </Fragment>
            ))}
          </RecessedPanel>
        </View>

        {/* Friends ranking */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow} numberOfLines={1}>Friends Ranking</Text>
          <RecessedPanel>
            <View style={styles.comingSoonBox}>
              <HardwareLed size="xs" tone="sage" isOn={false} />
              <Text style={styles.comingSoonText}>Update coming soon</Text>
            </View>
          </RecessedPanel>
        </View>

      </View>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CompDivider() {
  return (
    <>
      <View style={styles.dividerDark} />
      <View style={styles.dividerLight} />
    </>
  );
}

function RecessedPanel({ children }: { children: ReactNode }) {
  return (
    <LinearGradient
      colors={['#DEDAD0', '#FDFAF5']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.panelSeat}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(52,47,39,0.22)', 'rgba(52,47,39,0.11)', 'rgba(52,47,39,0.036)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.panelContactGap}
      />
      <View pointerEvents="none" style={styles.panelCavityShadow} />
      <View style={styles.panelField}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(17,19,18,0.09)', 'rgba(17,19,18,0.028)', 'rgba(17,19,18,0)']}
          locations={[0, 0.4, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.panelTopShade}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(52,47,39,0)', 'rgba(52,47,39,0.04)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.panelBottomDepth}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.2)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.panelBottomHighlight}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.52)', 'rgba(255,255,255,0.52)', 'rgba(255,255,255,0)']}
          locations={[0, 0.22, 0.78, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.panelBottomGlint}
        />
        {children}
      </View>
    </LinearGradient>
  );
}

const METRIC_RADIUS = 20;
const METRIC_GAP_INSET = 4;
const METRIC_GAP_RADIUS = METRIC_RADIUS - 2;
const METRIC_INNER_INSET = 6;
const METRIC_INNER_RADIUS = METRIC_RADIUS - 4;

function MetricCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <LinearGradient
      colors={['#DEDAD0', '#FDFAF5']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.metricSeat}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(52,47,39,0.22)', 'rgba(52,47,39,0.13)', 'rgba(52,47,39,0.066)', 'rgba(52,47,39,0.024)', 'rgba(52,47,39,0.006)', 'rgba(52,47,39,0)']}
        locations={[0, 0.14, 0.32, 0.55, 0.78, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.metricContactGap}
      />
      <View pointerEvents="none" style={styles.metricCavityShadow} />
      <View style={styles.metricField}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(17,19,18,0.13)', 'rgba(17,19,18,0.05)', 'rgba(17,19,18,0.01)', 'rgba(17,19,18,0)']}
          locations={[0, 0.35, 0.65, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.metricTopShade}
        />
        <Text style={styles.metricLabel} numberOfLines={1}>{label}</Text>
        {children}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.52)', 'rgba(255,255,255,0.52)', 'rgba(255,255,255,0)']}
          locations={[0, 0.22, 0.78, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.metricBottomGlint}
        />
      </View>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: 12,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoWrapper: {
    position: 'relative',
  },
  logoBevel: {
    ...typography.screenTitle,
    color: 'rgba(255,255,255,0.65)',
  },
  logo: {
    ...typography.screenTitle,
    color: 'rgba(17,19,18,0.64)',
    position: 'absolute',
    top: -1,
    left: 0,
    right: 0,
    textShadowColor: 'rgba(0,0,0,0.20)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 1,
  },

  // Metric cards
  metricsCol: {
    gap: 10,
  },
  metricSeat: {
    borderRadius: METRIC_RADIUS,
    padding: METRIC_INNER_INSET,
    position: 'relative',
  },
  metricContactGap: {
    position: 'absolute',
    top: METRIC_GAP_INSET,
    right: METRIC_GAP_INSET,
    bottom: METRIC_GAP_INSET,
    left: METRIC_GAP_INSET,
    borderRadius: METRIC_GAP_RADIUS,
  },
  metricCavityShadow: {
    position: 'absolute',
    top: METRIC_GAP_INSET + 1,
    right: METRIC_GAP_INSET + 1,
    bottom: METRIC_GAP_INSET + 1,
    left: METRIC_GAP_INSET + 1,
    borderRadius: METRIC_GAP_RADIUS - 1,
    backgroundColor: 'rgba(17,19,18,0.018)',
    shadowColor: '#111312',
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 1, height: 2 },
    elevation: 1,
  },
  metricField: {
    borderRadius: METRIC_INNER_RADIUS,
    backgroundColor: '#E4E0D8',
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricBottomGlint: {
    position: 'absolute',
    bottom: 1,
    left: 0,
    right: 0,
    height: 1,
    borderRadius: 1,
    zIndex: 3,
  },
  metricTopShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 22,
    zIndex: 2,
    pointerEvents: 'none',
  },
  metricLabel: {
    ...typography.meta,
    color: colors.muted,
    fontSize: 13,
    flex: 1,
  },

  // Section wrapper
  section: {
    gap: 8,
  },
  sectionEyebrow: {
    ...typography.panelLabel,
    color: colors.sage,
    textShadowColor: 'rgba(0,0,0,0.16)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 0.5,
  },
  comingSoonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 20,
  },
  comingSoonText: {
    ...typography.meta,
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  // Recessed panel bevel stack
  panelSeat: {
    width: '100%',
    borderRadius: PANEL_RADIUS,
    padding: PANEL_INNER_INSET,
    position: 'relative',
  },
  panelContactGap: {
    position: 'absolute',
    top: PANEL_GAP_INSET,
    right: PANEL_GAP_INSET,
    bottom: PANEL_GAP_INSET,
    left: PANEL_GAP_INSET,
    borderRadius: PANEL_GAP_RADIUS,
  },
  panelCavityShadow: {
    position: 'absolute',
    top: PANEL_GAP_INSET + 1,
    right: PANEL_GAP_INSET + 1,
    bottom: PANEL_GAP_INSET + 1,
    left: PANEL_GAP_INSET + 1,
    borderRadius: PANEL_GAP_RADIUS - 1,
    backgroundColor: 'rgba(17,19,18,0.018)',
    shadowColor: '#111312',
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 1, height: 2 },
    elevation: 1,
  },
  panelField: {
    overflow: 'hidden',
    borderRadius: PANEL_INNER_RADIUS,
    backgroundColor: '#E4E0D8',
    paddingHorizontal: 14,
    position: 'relative',
    zIndex: 1,
  },
  panelTopShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
  },
  panelBottomDepth: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 18,
  },
  panelBottomHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 14,
  },
  panelBottomGlint: {
    position: 'absolute',
    bottom: 1,
    left: 0,
    right: 0,
    height: 1,
    borderRadius: 1,
    zIndex: 3,
  },

  // Bar chart
  chartArea: {
    paddingTop: 14,
    paddingBottom: 12,
  },

  // Comparison table
  compHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
  },
  compRowLabel: {
    ...typography.meta,
    color: colors.muted,
    fontSize: 13,
    flex: 1,
  },
  compColHeader: {
    ...typography.instrumentLabel,
    color: colors.muted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
    textAlign: 'right',
  },
  compValue: {
    fontFamily: typography.cardTitle.fontFamily,
    color: 'rgba(17,19,18,0.68)',
    fontSize: 13,
    flex: 1,
    textAlign: 'right',
  },
  compValueMuted: {
    fontFamily: typography.cardTitle.fontFamily,
    color: 'rgba(17,19,18,0.32)',
    fontSize: 13,
    flex: 1,
    textAlign: 'right',
  },
  compValueUp: {
    color: colors.sage,
  },
  compValueDown: {
    color: colors.orange,
  },
  // Beveled groove divider (two 1px lines: dark top + light bottom)
  dividerDark: {
    height: 1,
    backgroundColor: 'rgba(17,19,18,0.18)',
    marginHorizontal: -14,
  },
  dividerLight: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.65)',
    marginHorizontal: -14,
  },
});
