import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getSessionHistory, type SessionRecord } from '../../services/storage';
import { EmptyState } from '../intent/EmptyState';
import { formatPlainDuration, formatSessionDate, formatSessionStatus } from '../intent/format';
import { colors, layout, typography } from '../intent/theme';

type SessionFilter = 'all' | SessionRecord['status'];

type FilterOption = {
  label: string;
  value: SessionFilter;
};

const FILTER_OPTIONS: FilterOption[] = [
  { label: 'All', value: 'all' },
  { label: 'Completed', value: 'success' },
  { label: 'Ended early', value: 'partial' },
  { label: 'Too many penalties', value: 'ended' },
];

function formatPointsLabel(pointsEarned: number) {
  return pointsEarned > 0 ? `+${pointsEarned}` : '0';
}

export default function RecentScreen() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<SessionFilter>('all');

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      getSessionHistory().then((history) => {
        if (isActive) {
          setSessions(history);
        }
      });

      return () => {
        isActive = false;
      };
    }, [])
  );

  const filteredSessions = selectedFilter === 'all'
    ? sessions
    : sessions.filter((session) => session.status === selectedFilter);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.pageList}
        contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>Recent</Text>
          <Text style={styles.subtitle}>Your latest detox sessions.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Session history</Text>
            <Text style={styles.cardCount}>{filteredSessions.length}</Text>
          </View>

          <View style={styles.filterRow}>
            {FILTER_OPTIONS.map((option) => {
              const isSelected = selectedFilter === option.value;

              return (
                <View key={option.value} style={styles.filterPillSeat}>
                  <Pressable
                    onPress={() => setSelectedFilter(option.value)}
                    style={({ pressed }) => [
                      styles.filterPill,
                      isSelected && styles.selectedFilterPill,
                      pressed && styles.filterPillPressed,
                    ]}>
                    <LinearGradient
                      pointerEvents="none"
                      colors={["rgba(255,255,255,0.38)", "rgba(220,216,207,0.16)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.filterPillGradient}
                    />
                    <View pointerEvents="none" style={styles.filterPillBevel} />
                    <Text style={[styles.filterPillText, isSelected && styles.selectedFilterPillText]}>
                      {option.label}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>

          {filteredSessions.length > 0 ? (
            filteredSessions.map((session) => (
              <View key={session.id} style={styles.sessionRow}>
                <View style={styles.sessionMain}>
                  <Text style={styles.sessionDuration}>{formatPlainDuration(session.durationSeconds)}</Text>
                  {session.purpose ? (
                    <View style={styles.sessionPurposePill}>
                      <Text style={styles.sessionPurposeText}>#{session.purpose}</Text>
                    </View>
                  ) : null}
                  {session.note ? <Text style={styles.sessionNote}>Note: {session.note}</Text> : null}
                  <Text style={styles.sessionMeta}>
                    {formatSessionDate(session.date)} - {formatSessionStatus(session.status)}
                  </Text>
                  <Text style={styles.sessionMeta}>
                    Completed {formatPlainDuration(session.completedSeconds)} - {session.penaltyCount} penalties
                  </Text>
                </View>

                <Text style={styles.sessionPoints}>{formatPointsLabel(session.pointsEarned)}</Text>
              </View>
            ))
          ) : (
            <EmptyState
              title={sessions.length > 0 ? 'No sessions in this category yet' : 'No sessions yet'}
              body={sessions.length > 0 ? 'Try another filter or complete a new session.' : 'Start a detox session and your history will appear here.'}
            />
          )}
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
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: 16,
    paddingBottom: 28,
  },
  header: {
    marginBottom: 16,
  },
  logo: {
    ...typography.screenTitle,
    color: colors.ink,
  },
  subtitle: {
    ...typography.body,
    color: colors.muted,
    fontSize: 14,
    marginTop: 6,
  },
  card: {
    borderWidth: 0,
    borderColor: colors.line,
    borderRadius: layout.cardRadius,
    backgroundColor: colors.surface,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    ...typography.cardTitle,
    color: colors.ink,
  },
  cardCount: {
    ...typography.meta,
    color: colors.muted,
    fontSize: 13,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 2,
  },
  filterPillSeat: {
    borderRadius: 999,
    backgroundColor: 'rgba(213,209,200,0.44)',
    padding: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.045,
    shadowRadius: 6,
    shadowOffset: { width: 1, height: 3 },
    elevation: 1,
  },
  filterPill: {
    borderWidth: 0,
    borderColor: colors.line,
    borderRadius: 999,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterPillGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
  },
  filterPillBevel: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  selectedFilterPill: {
    borderColor: colors.sage,
    backgroundColor: colors.sageSoft,
  },
  filterPillPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  filterPillText: {
    ...typography.chip,
    color: colors.muted,
    fontSize: 12,
  },
  selectedFilterPillText: {
    color: colors.sage,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 0,
    borderTopColor: colors.line,
    gap: 16,
    paddingTop: 14,
    marginTop: 14,
  },
  sessionMain: {
    flex: 1,
  },
  sessionDuration: {
    ...typography.cardTitle,
    color: colors.ink,
    fontSize: 17,
  },
  sessionPurposePill: {
    alignSelf: 'flex-start',
    borderWidth: 0,
    borderRadius: 999,
    backgroundColor: colors.sageSoft,
    marginTop: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  sessionPurposeText: {
    ...typography.chip,
    color: colors.sage,
    fontSize: 11,
  },
  sessionNote: {
    ...typography.body,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  sessionMeta: {
    ...typography.meta,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  sessionPoints: {
    fontFamily: typography.cardTitle.fontFamily,
    color: colors.sage,
    fontSize: 17,
  },
});


