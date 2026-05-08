import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getSessionHistory, getStats, type SessionRecord } from '../../services/storage';
import { CeramicButton } from '../intent/CeramicButton';
import { formatPlainDuration } from '../intent/format';
import { colors, layout, typography } from '../intent/theme';

function isToday(date: string) {
  const parsedDate = new Date(date);
  const today = new Date();

  return (
    parsedDate.getFullYear() === today.getFullYear() &&
    parsedDate.getMonth() === today.getMonth() &&
    parsedDate.getDate() === today.getDate()
  );
}

export default function DashboardScreen() {
  const router = useRouter();
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

      return () => {
        isActive = false;
      };
    }, [])
  );

  const todaySummary = useMemo(() => {
    const todaySessions = history.filter((session) => isToday(session.date));
    const completedSeconds = todaySessions.reduce((sum, session) => sum + session.completedSeconds, 0);
    const pointsEarned = todaySessions.reduce((sum, session) => sum + session.pointsEarned, 0);

    return {
      sessionCount: todaySessions.length,
      focusTime: completedSeconds > 0 ? formatPlainDuration(completedSeconds) : '0m',
      pointsEarned,
    };
  }, [history]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.pageList}
        contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>Intent</Text>
          <Text style={styles.subtitle}>Choose quiet on purpose.</Text>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Today</Text>
          <Text style={styles.heroTitle}>A calmer session is one tap away.</Text>
          <CeramicButton
            size="medium"
            onPress={() => router.push('/session')}
            style={styles.primaryButton}
            textStyle={styles.primaryButtonText}
            label="Start session"
          />
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{totalPoints}</Text>
            <Text style={styles.metricLabel}>Total points</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{currentStreak}</Text>
            <Text style={styles.metricLabel}>Current streak</Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Today&apos;s summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Sessions</Text>
            <Text style={styles.summaryValue}>{todaySummary.sessionCount}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Focused time</Text>
            <Text style={styles.summaryValue}>{todaySummary.focusTime}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Points earned</Text>
            <Text style={styles.summaryValue}>+{todaySummary.pointsEarned}</Text>
          </View>
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
  heroCard: {
    borderWidth: 0,
    borderColor: colors.line,
    borderRadius: layout.cardRadius,
    backgroundColor: colors.surface,
    padding: 18,
  },
  heroEyebrow: {
    ...typography.instrumentLabel,
    color: colors.sage,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontFamily: typography.screenTitle.fontFamily,
    color: colors.ink,
    fontSize: 26,
    lineHeight: 32,
    marginTop: 8,
  },
  primaryButton: {
    marginTop: 18,
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.sage,
    fontSize: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  metricCard: {
    flex: 1,
    borderWidth: 0,
    borderColor: colors.line,
    borderRadius: layout.cardRadius,
    backgroundColor: colors.surface,
    padding: 16,
  },
  metricValue: {
    ...typography.valueLarge,
    color: colors.ink,
    fontSize: 28,
  },
  metricLabel: {
    ...typography.meta,
    color: colors.muted,
    fontSize: 13,
    marginTop: 6,
  },
  summaryCard: {
    borderWidth: 0,
    borderColor: colors.line,
    borderRadius: layout.cardRadius,
    backgroundColor: colors.surface,
    marginTop: 12,
    padding: 16,
  },
  cardTitle: {
    ...typography.cardTitle,
    color: colors.ink,
    marginBottom: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 0,
    borderTopColor: colors.line,
    paddingTop: 12,
    marginTop: 12,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.muted,
    fontSize: 14,
  },
  summaryValue: {
    fontFamily: typography.cardTitle.fontFamily,
    color: colors.ink,
    fontSize: 15,
  },
});
