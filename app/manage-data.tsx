import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  calculateAchievements,
  getFriends,
  getInviteCode,
  getSessionHistory,
  getStats,
  resetAll,
  resetHistory,
  resetStats,
  type Stats,
} from '../services/storage';
import { CeramicButton } from '../components/intent/CeramicButton';
import { colors, layout, typography } from '../components/intent/theme';

type ResetKey = 'points' | 'streak' | 'history' | 'all';

type ResetAction = {
  key: ResetKey;
  title: string;
  description: string;
  buttonLabel: string;
  confirmTitle: string;
  confirmMessage: string;
  isDestructive?: boolean;
};

const resetActions: ResetAction[] = [
  {
    key: 'points',
    title: 'Reset total points',
    description: 'Set your total points back to 0. Streak, friends, and history stay intact.',
    buttonLabel: 'Reset points',
    confirmTitle: 'Reset total points?',
    confirmMessage: 'Your total points will be set to 0. This cannot be undone.',
  },
  {
    key: 'streak',
    title: 'Reset streak',
    description: 'Set your current daily streak back to 0. Points and history stay intact.',
    buttonLabel: 'Reset streak',
    confirmTitle: 'Reset streak?',
    confirmMessage: 'Your current streak will be set to 0. This cannot be undone.',
  },
  {
    key: 'history',
    title: 'Reset session history',
    description: 'Clear all saved session records. Points, streak, and friends stay intact.',
    buttonLabel: 'Reset history',
    confirmTitle: 'Reset session history?',
    confirmMessage: 'Your saved session history will be cleared. This cannot be undone.',
  },
  {
    key: 'all',
    title: 'Reset all data',
    description: 'Clear stats, session history, achievements, active sessions, friends, and invite code.',
    buttonLabel: 'Reset all data',
    confirmTitle: 'Reset all data?',
    confirmMessage:
      'This clears points, streak, session history, achievements, any active session, friends, and your invite code. This cannot be undone.',
    isDestructive: true,
  },
];

const emptyStats: Stats = {
  totalPoints: 0,
  currentStreak: 0,
  lastSuccessDate: null,
};

export default function ManageDataScreen() {
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [sessionCount, setSessionCount] = useState(0);
  const [friendCount, setFriendCount] = useState(0);
  const [achievementCount, setAchievementCount] = useState(0);
  const [inviteCode, setInviteCode] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const reloadData = useCallback(async () => {
    const [nextStats, history, friends, nextInviteCode] = await Promise.all([
      getStats(),
      getSessionHistory(),
      getFriends(),
      getInviteCode(),
    ]);
    const achievements = calculateAchievements(nextStats, history);

    setStats(nextStats);
    setSessionCount(history.length);
    setFriendCount(friends.length);
    setInviteCode(nextInviteCode);
    setAchievementCount(achievements.filter((achievement) => achievement.isUnlocked).length);

    console.log('stats after reset:', nextStats);
  }, []);

  useEffect(() => {
    void reloadData();
  }, [reloadData]);

  const runReset = useCallback(
    async (label: string, resetCallback: () => Promise<unknown>) => {
      setIsResetting(true);
      console.log(`${label} pressed`);

      try {
        await resetCallback();
        await reloadData();
        console.log(`${label} completed`);
      } finally {
        setIsResetting(false);
      }
    },
    [reloadData]
  );

  const handleResetPoints = useCallback(async () => {
    await runReset('reset points', () => resetStats('points'));
  }, [runReset]);

  const handleResetStreak = useCallback(async () => {
    await runReset('reset streak', () => resetStats('streak'));
  }, [runReset]);

  const handleResetHistory = useCallback(async () => {
    await runReset('reset history', resetHistory);
  }, [runReset]);

  const handleResetAll = useCallback(async () => {
    await runReset('reset all', resetAll);
  }, [runReset]);

  const executeReset = (key: ResetKey) => {
    if (key === 'points') {
      void handleResetPoints();
      return;
    }

    if (key === 'streak') {
      void handleResetStreak();
      return;
    }

    if (key === 'history') {
      void handleResetHistory();
      return;
    }

    void handleResetAll();
  };

  const confirmReset = (action: ResetAction) => {
    if (Platform.OS === 'web') {
      const shouldReset = window.confirm(`${action.confirmTitle}\n\n${action.confirmMessage}`);

      if (shouldReset) {
        executeReset(action.key);
      }

      return;
    }

    Alert.alert(action.confirmTitle, action.confirmMessage, [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: action.buttonLabel,
        style: action.isDestructive ? 'destructive' : 'default',
        onPress: () => executeReset(action.key),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.pageList}
        contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>Manage data</Text>
          <Text style={styles.subtitle}>Local storage controls for Intent.</Text>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{stats.totalPoints}</Text>
            <Text style={styles.summaryLabel}>Points</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{stats.currentStreak}</Text>
            <Text style={styles.summaryLabel}>Streak</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{sessionCount}</Text>
            <Text style={styles.summaryLabel}>Sessions</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{friendCount}</Text>
            <Text style={styles.summaryLabel}>Friends</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reset options</Text>
          <Text style={styles.cardBody}>
            Reset actions ask for confirmation first and refresh this screen immediately after they complete.
          </Text>
          <Text style={styles.debugText}>Current invite code: {inviteCode || 'Not loaded'}</Text>

          <View style={styles.actions}>
            {resetActions.map((action) => (
              <View key={action.title} style={styles.actionRow}>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.actionDescription}>{action.description}</Text>
                </View>

                <CeramicButton
                  disabled={isResetting}
                  size="medium"
                  onPress={() => confirmReset(action)}
                  textStyle={[styles.resetButtonText, action.isDestructive && styles.destructiveButtonText]}
                  label={action.buttonLabel}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteText}>Unlocked achievements: {achievementCount}</Text>
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
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    width: '48%',
    borderWidth: 0,
    borderColor: colors.line,
    borderRadius: layout.cardRadius,
    backgroundColor: colors.surface,
    padding: 14,
  },
  summaryValue: {
    ...typography.valueLarge,
    color: colors.ink,
    fontSize: 24,
  },
  summaryLabel: {
    ...typography.meta,
    color: colors.muted,
    fontSize: 12,
    marginTop: 6,
  },
  card: {
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
  },
  cardBody: {
    ...typography.body,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  debugText: {
    ...typography.meta,
    color: colors.muted,
    fontSize: 12,
    marginTop: 10,
  },
  actions: {
    gap: 12,
    marginTop: 14,
  },
  actionRow: {
    borderTopWidth: 0,
    borderTopColor: colors.line,
    paddingTop: 14,
  },
  actionCopy: {
    marginBottom: 12,
  },
  actionTitle: {
    ...typography.cardTitle,
    color: colors.ink,
    fontSize: 16,
  },
  actionDescription: {
    ...typography.body,
    marginTop: 5,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  resetButtonText: {
    ...typography.button,
    color: colors.sage,
    fontSize: 15,
  },
  destructiveButtonText: {
    color: colors.clay,
  },
  noteCard: {
    borderWidth: 0,
    borderColor: colors.line,
    borderRadius: layout.cardRadius,
    backgroundColor: colors.surface,
    marginTop: 12,
    padding: 14,
  },
  noteText: {
    ...typography.meta,
    color: colors.muted,
    fontSize: 13,
  },
});
