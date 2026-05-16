import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getSessionHistory, type SessionRecord } from '../../services/storage';
import { CeramicButton } from '../intent/CeramicButton';
import { EmptyState } from '../intent/EmptyState';
import { HardwareLed } from '../intent/HardwareLed';
import { formatPlainDuration, formatSessionDate, formatSessionStatus } from '../intent/format';
import { colors, spacing, typography } from '../../constants/theme';

const PANEL_RADIUS = 22;
const PANEL_GAP_INSET = 4;
const PANEL_GAP_RADIUS = PANEL_RADIUS - 2;
const PANEL_INNER_INSET = 6;
const PANEL_INNER_RADIUS = PANEL_RADIUS - 4;

type SessionFilter = 'all' | SessionRecord['status'];

type FilterOption = { label: string; value: SessionFilter };

const FILTER_OPTIONS: FilterOption[] = [
  { label: 'All',        value: 'all' },
  { label: 'Done',       value: 'success' },
  { label: 'Quit',       value: 'partial' },
  { label: 'Penalized',  value: 'ended' },
];

function formatPointsLabel(pts: number) {
  return pts > 0 ? `+${pts}` : '0';
}

function RowDivider() {
  return (
    <>
      <View style={styles.dividerDark} />
      <View style={styles.dividerLight} />
    </>
  );
}

export default function RecentScreen() {
  const [sessions, setSessions]           = useState<SessionRecord[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<SessionFilter>('all');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getSessionHistory().then((h) => { if (active) setSessions(h); });
      return () => { active = false; };
    }, [])
  );

  const filteredSessions = selectedFilter === 'all'
    ? sessions
    : sessions.filter((s) => s.status === selectedFilter);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.pageList}
        contentContainerStyle={styles.container}>

        <View style={styles.header}>
          <View style={styles.logoWrapper}>
            <Text style={styles.logoBevel} importantForAccessibility="no">Recent</Text>
            <Text style={styles.logo}>Recent</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionEyebrow}>Session history</Text>
            <Text style={styles.sectionCount}>{filteredSessions.length}</Text>
          </View>

          {/* Filter chips */}
          <View style={styles.filterRow}>
            {FILTER_OPTIONS.map((option) => {
              const isSelected = selectedFilter === option.value;
              return (
                <CeramicButton
                  key={option.value}
                  size="small"
                  onPress={() => setSelectedFilter(option.value)}
                  surfaceStyle={styles.filterChipSurface}>
                  <HardwareLed isOn={isSelected} size="small" />
                  <Text style={[styles.filterPillText, isSelected && styles.selectedFilterPillText]}>
                    {option.label}
                  </Text>
                </CeramicButton>
              );
            })}
          </View>

          <LinearGradient
            colors={['#DEDAD0', '#E3E0D7', '#ECEAE2', '#F4F2EB', '#FDFAF5']}
            locations={[0, 0.22, 0.48, 0.76, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.panelSeat}>
            <LinearGradient pointerEvents="none" colors={['rgba(52,47,39,0.18)', 'rgba(52,47,39,0.08)', 'rgba(52,47,39,0.02)', 'rgba(52,47,39,0)']} locations={[0, 0.3, 0.7, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.panelGapTop} />
            <LinearGradient pointerEvents="none" colors={['rgba(52,47,39,0.10)', 'rgba(52,47,39,0.04)', 'rgba(52,47,39,0)']} locations={[0, 0.5, 1]} start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0 }} style={styles.panelGapBottom} />
            <LinearGradient pointerEvents="none" colors={['rgba(52,47,39,0.10)', 'rgba(52,47,39,0.03)', 'rgba(52,47,39,0)']} locations={[0, 0.5, 1]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.panelGapLeft} />
            <LinearGradient pointerEvents="none" colors={['rgba(52,47,39,0.10)', 'rgba(52,47,39,0.03)', 'rgba(52,47,39,0)']} locations={[0, 0.5, 1]} start={{ x: 1, y: 0.5 }} end={{ x: 0, y: 0.5 }} style={styles.panelGapRight} />
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

              {filteredSessions.length > 0 ? (
                filteredSessions.map((session, i, arr) => (
                  <Fragment key={session.id}>
                    <View style={styles.sessionRow}>
                      <View style={styles.sessionCardInner}>
                        {/* Left: LED status anchor */}
                        <View style={styles.sessionLedCol}>
                          <HardwareLed
                            size="small"
                            tone={session.status === 'partial' ? 'orange' : 'sage'}
                            isOn={session.status !== 'ended'}
                          />
                        </View>
                        {/* Right: content */}
                        <View style={styles.sessionContent}>
                          <View style={styles.sessionTopRow}>
                            <Text style={styles.sessionDuration} numberOfLines={1}>{formatPlainDuration(session.durationSeconds)}</Text>
                            <Text style={styles.sessionPoints}>{formatPointsLabel(session.pointsEarned)}</Text>
                          </View>
                          <View style={styles.sessionTagRow}>
                            <Text style={[styles.sessionStatusText, session.status === 'success' && styles.statusSuccessText, session.status === 'partial' && styles.statusPartialText]} numberOfLines={1}>
                              {formatSessionStatus(session.status)}
                            </Text>
                            {session.purpose ? (
                              <>
                                <Text style={styles.sessionMetaDot}>·</Text>
                                <Text style={styles.sessionPurposeText} numberOfLines={1}>#{session.purpose}</Text>
                              </>
                            ) : null}
                          </View>
                          <Text style={styles.sessionMeta} numberOfLines={1}>
                            {formatSessionDate(session.date)}{session.status !== 'success' && session.completedSeconds > 0 ? ` · ${formatPlainDuration(session.completedSeconds)} completed` : ''}{session.penaltyCount > 0 ? ` · ${session.penaltyCount} ${session.penaltyCount === 1 ? 'penalty' : 'penalties'}` : ''}
                          </Text>
                          {session.note ? <Text style={styles.sessionNote} numberOfLines={2}>{'"'}{session.note}{'"'}</Text> : null}
                        </View>
                      </View>
                    </View>
                    {i < arr.length - 1 && <RowDivider />}
                  </Fragment>
                ))
              ) : (
                <EmptyState
                  title={sessions.length > 0 ? 'No sessions in this category yet' : 'No sessions yet'}
                  body={sessions.length > 0 ? 'Try another filter or complete a new session.' : 'Start a detox session and your history will appear here.'}
                />
              )}
            </View>
          </LinearGradient>
        </View>

      </ScrollView>
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
  },
  header: {},
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
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 14,
  },
  section: {
    gap: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionEyebrow: {
    ...typography.panelLabel,
    color: colors.sage,
    textShadowColor: 'rgba(0,0,0,0.16)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 0.5,
  },
  sectionCount: {
    ...typography.meta,
    color: colors.muted,
    fontSize: 11,
  },

  // Recessed panel (same stack as DashboardScreen)
  panelSeat: {
    width: '100%',
    borderRadius: PANEL_RADIUS,
    padding: PANEL_INNER_INSET,
    position: 'relative',
  },
  panelGapTop: {
    position: 'absolute',
    top: PANEL_GAP_INSET, left: PANEL_GAP_INSET, right: PANEL_GAP_INSET,
    height: 22,
    borderTopLeftRadius: PANEL_GAP_RADIUS,
    borderTopRightRadius: PANEL_GAP_RADIUS,
  },
  panelGapBottom: {
    position: 'absolute',
    bottom: PANEL_GAP_INSET, left: PANEL_GAP_INSET, right: PANEL_GAP_INSET,
    height: 18,
    borderBottomLeftRadius: PANEL_GAP_RADIUS,
    borderBottomRightRadius: PANEL_GAP_RADIUS,
  },
  panelGapLeft: {
    position: 'absolute',
    left: PANEL_GAP_INSET, top: PANEL_GAP_INSET, bottom: PANEL_GAP_INSET,
    width: 18,
    borderTopLeftRadius: PANEL_GAP_RADIUS,
    borderBottomLeftRadius: PANEL_GAP_RADIUS,
  },
  panelGapRight: {
    position: 'absolute',
    right: PANEL_GAP_INSET, top: PANEL_GAP_INSET, bottom: PANEL_GAP_INSET,
    width: 18,
    borderTopRightRadius: PANEL_GAP_RADIUS,
    borderBottomRightRadius: PANEL_GAP_RADIUS,
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
    shadowOpacity: 0.26,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  panelField: {
    overflow: 'hidden',
    borderRadius: PANEL_INNER_RADIUS,
    backgroundColor: '#E4E0D8',
    paddingLeft: 8,
    paddingRight: 14,
    position: 'relative',
    zIndex: 1,
  },
  panelTopShade: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 28,
  },
  panelBottomDepth: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: 18,
  },
  panelBottomHighlight: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
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
  // Filter chips
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  filterChipSurface: {
    gap: 0,
    paddingLeft: 0,
    paddingRight: 8,
    justifyContent: 'center',
  },
  filterPillText: {
    ...typography.chip,
    color: colors.muted,
    fontSize: 12,
  },
  selectedFilterPillText: {
    color: colors.sage,
  },

  // Beveled groove divider
  dividerDark: {
    height: 1,
    backgroundColor: 'rgba(17,19,18,0.13)',
    marginLeft: -8,
    marginRight: -14,
  },
  dividerLight: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.65)',
    marginLeft: -8,
    marginRight: -14,
  },

  // Session rows
  sessionRow: {
    paddingVertical: 2,
  },
  sessionCardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 12,
  },
  sessionLedCol: {
    paddingTop: 2,
  },
  sessionContent: {
    flex: 1,
    gap: 3,
  },
  sessionTopRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  sessionTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sessionDuration: {
    ...typography.cardTitle,
    color: colors.ink,
    fontSize: 20,
    flex: 1,
  },
  sessionPoints: {
    fontFamily: typography.cardTitle.fontFamily,
    color: colors.sage,
    fontSize: 16,
  },
  sessionStatusText: {
    ...typography.chip,
    color: colors.muted,
    fontSize: 12,
  },
  statusSuccessText: {
    color: colors.sage,
  },
  statusPartialText: {
    color: colors.orange,
  },
  sessionMetaDot: {
    ...typography.meta,
    color: colors.muted,
    fontSize: 11,
  },
  sessionPurposeText: {
    ...typography.chip,
    color: colors.sage,
    fontSize: 12,
  },
  sessionMeta: {
    ...typography.meta,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  sessionNote: {
    ...typography.body,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
  },
});
