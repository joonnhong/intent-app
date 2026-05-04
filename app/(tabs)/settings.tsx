import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resetAll, resetHistory, resetStats } from '../../services/storage';

const colors = {
  background: '#F6F3EA',
  surface: '#FFFFFF',
  ink: '#1F2723',
  muted: '#69746F',
  sage: '#4C7A6D',
  sageSoft: '#DDE9E3',
  clay: '#B8664B',
  claySoft: '#F0DDD5',
  line: '#E6E0D2',
};

type ResetAction = {
  title: string;
  description: string;
  buttonLabel: string;
  confirmTitle: string;
  confirmMessage: string;
  isDestructive?: boolean;
  onConfirm: () => Promise<unknown>;
};

const resetActions: ResetAction[] = [
  {
    title: 'Total points',
    description: 'Set your total points back to 0. Streak and history stay intact.',
    buttonLabel: 'Reset points',
    confirmTitle: 'Reset total points?',
    confirmMessage: 'Your total points will be set to 0. This cannot be undone.',
    onConfirm: () => resetStats('points'),
  },
  {
    title: 'Streak',
    description: 'Set your current daily streak back to 0.',
    buttonLabel: 'Reset streak',
    confirmTitle: 'Reset streak?',
    confirmMessage: 'Your current streak will be set to 0. This cannot be undone.',
    onConfirm: () => resetStats('streak'),
  },
  {
    title: 'Session history',
    description: 'Clear all saved session records. Points and streak stay intact.',
    buttonLabel: 'Reset history',
    confirmTitle: 'Reset session history?',
    confirmMessage: 'Your saved session history will be cleared. This cannot be undone.',
    onConfirm: resetHistory,
  },
  {
    title: 'Everything',
    description: 'Clear stats, history, and achievement progress.',
    buttonLabel: 'Reset all',
    confirmTitle: 'Reset everything?',
    confirmMessage: 'Your points, streak, session history, and achievements will be cleared.',
    isDestructive: true,
    onConfirm: resetAll,
  },
];

export default function SettingsScreen() {
  const confirmReset = (action: ResetAction) => {
    Alert.alert(action.confirmTitle, action.confirmMessage, [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: action.buttonLabel,
        style: action.isDestructive ? 'destructive' : 'default',
        onPress: () => {
          void action.onConfirm();
        },
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
          <Text style={styles.logo}>Settings</Text>
          <Text style={styles.subtitle}>Manage your Intent data</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Reset options</Text>
          <Text style={styles.infoBody}>
            These actions update local storage only. Your Home screen will refresh the next time it opens.
          </Text>
        </View>

        <View style={styles.actions}>
          {resetActions.map((action) => (
            <View key={action.title} style={styles.actionCard}>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionDescription}>{action.description}</Text>
              </View>

              <Pressable
                onPress={() => confirmReset(action)}
                style={({ pressed }) => [
                  styles.resetButton,
                  action.isDestructive && styles.destructiveButton,
                  pressed && styles.buttonPressed,
                ]}>
                <Text style={[styles.resetButtonText, action.isDestructive && styles.destructiveButtonText]}>
                  {action.buttonLabel}
                </Text>
              </Pressable>
            </View>
          ))}
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
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
  },
  header: {
    marginBottom: 18,
  },
  logo: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  infoCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.surface,
    padding: 16,
  },
  infoTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  infoBody: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  actions: {
    gap: 12,
    marginTop: 14,
  },
  actionCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.surface,
    padding: 16,
  },
  actionCopy: {
    marginBottom: 14,
  },
  actionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  actionDescription: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  resetButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  destructiveButton: {
    borderColor: colors.claySoft,
    backgroundColor: colors.surface,
  },
  resetButtonText: {
    color: colors.sage,
    fontSize: 15,
    fontWeight: '900',
  },
  destructiveButtonText: {
    color: colors.clay,
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
});
