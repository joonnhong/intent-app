import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addFriendByCode,
  calculateAchievements,
  getFriends,
  getInviteCode,
  getSessionHistory,
  getSoundEffectsEnabled,
  getStats,
  saveSoundEffectsEnabled,
  type Achievement,
  type Friend,
  type SessionRecord,
  type Stats,
} from '../../services/storage';
import { CeramicButton } from '../intent/CeramicButton';
import { EmptyState } from '../intent/EmptyState';
import { colors, layout, typography } from '../intent/theme';

const emptyStats: Stats = {
  totalPoints: 0,
  currentStreak: 0,
  lastSuccessDate: null,
};

export default function AccountScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(true);

  const refreshAccountData = useCallback(async () => {
    const [nextStats, sessions, nextInviteCode, nextFriends, nextSoundEffectsEnabled] = await Promise.all([
      getStats(),
      getSessionHistory(),
      getInviteCode(),
      getFriends(),
      getSoundEffectsEnabled(),
    ]);

    setStats(nextStats);
    setHistory(sessions);
    setAchievements(calculateAchievements(nextStats, sessions));
    setInviteCode(nextInviteCode);
    setFriends(nextFriends);
    setSoundEffectsEnabled(nextSoundEffectsEnabled);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      refreshAccountData().catch(() => {
        if (isActive) {
          setStats(emptyStats);
          setHistory([]);
          setAchievements([]);
          setFriends([]);
          setSoundEffectsEnabled(true);
        }
      });

      return () => {
        isActive = false;
      };
    }, [refreshAccountData])
  );

  const shareInviteCode = () => {
    if (!inviteCode) {
      return;
    }

    void Share.share({
      message: `Join me on Intent. My invite code is ${inviteCode}`,
    });
  };

  const toggleSoundEffects = (nextValue: boolean) => {
    setSoundEffectsEnabled(nextValue);
    void saveSoundEffectsEnabled(nextValue);
  };

  const addFriend = () => {
    void addFriendByCode(friendCodeInput).then((friend) => {
      if (!friend) {
        Alert.alert('Invite code not added', 'Check the code, or make sure it is not already in your friends list.');
        return;
      }

      setFriendCodeInput('');
      void refreshAccountData();
    });
  };

  const unlockedCount = achievements.filter((achievement) => achievement.isUnlocked).length;
  const rankedFriends = [...friends].sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.pageList}
        contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>Account</Text>
          <Text style={styles.subtitle}>Stats, badges, friends, and local data.</Text>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{stats.totalPoints}</Text>
            <Text style={styles.summaryLabel}>Total points</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{stats.currentStreak}</Text>
            <Text style={styles.summaryLabel}>Current streak</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{history.length}</Text>
            <Text style={styles.summaryLabel}>Sessions</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{unlockedCount}</Text>
            <Text style={styles.summaryLabel}>Badges</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Friends</Text>
            <Text style={styles.cardCount}>{friends.length}</Text>
          </View>

          <View style={styles.inviteBox}>
            <Text style={styles.inviteLabel}>Your invite code</Text>
            <Text style={styles.inviteCode}>{inviteCode || 'INTENT------'}</Text>
            <CeramicButton
              size="medium"
              onPress={shareInviteCode}
              style={styles.shareButton}
              textStyle={styles.shareButtonText}
              label="Share invite code"
            />
          </View>

          <View style={styles.qrPlaceholder}>
            <Text style={styles.qrText}>QR invite coming soon</Text>
          </View>

          <View style={styles.addFriendBox}>
            <Text style={styles.addFriendLabel}>Add friend by code</Text>
            <View style={styles.inputRow}>
              <TextInput
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="INTENT-AB12CD"
                placeholderTextColor={colors.muted}
                value={friendCodeInput}
                onChangeText={setFriendCodeInput}
                style={styles.friendInput}
              />
              <CeramicButton
                size="medium"
                onPress={addFriend}
                style={styles.addButton}
                textStyle={styles.addButtonText}
                label="Add"
              />
            </View>
          </View>

          {rankedFriends.length > 0 ? (
            <View style={styles.friendsList}>
              <Text style={styles.leaderboardTitle}>Friend leaderboard</Text>
              {rankedFriends.map((friend, index) => (
                <View key={friend.id} style={styles.friendRow}>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>{index + 1}</Text>
                  </View>

                  <View style={styles.friendMain}>
                    <Text style={styles.friendName}>{friend.displayName}</Text>
                    <Text style={styles.friendCode}>{friend.inviteCode}</Text>
                  </View>

                  <View style={styles.friendStats}>
                    <Text style={styles.friendPoints}>{friend.totalPoints} pts</Text>
                    <Text style={styles.friendStreak}>{friend.currentStreak} day streak</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <EmptyState title="No friends yet" body="Add an invite code to keep a small local friends list." />
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Achievements</Text>
            <Text style={styles.cardCount}>{unlockedCount}/{achievements.length}</Text>
          </View>

          {achievements.length > 0 ? (
            <View style={styles.badgeGrid}>
              {achievements.map((achievement) => (
                <View
                  key={achievement.id}
                  style={[
                    styles.badgeTile,
                    achievement.isUnlocked ? styles.activeBadgeTile : styles.lockedBadgeTile,
                  ]}>
                  <Text
                    style={[
                      styles.badgeTitle,
                      achievement.isUnlocked ? styles.activeBadgeTitle : styles.lockedBadgeTitle,
                    ]}>
                    {achievement.title}
                  </Text>
                  <Text style={styles.badgeDescription}>{achievement.description}</Text>
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              title="No achievements yet"
              body="Finish a successful detox session to unlock your first badge."
            />
          )}
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account settings</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>Sound effects</Text>
              <Text style={styles.settingDescription}>Play gentle sounds for session results and penalties.</Text>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: soundEffectsEnabled }}
              onPress={() => toggleSoundEffects(!soundEffectsEnabled)}
              style={({ pressed }) => [
                styles.soundToggle,
                soundEffectsEnabled && styles.soundToggleOn,
                pressed && styles.soundTogglePressed,
              ]}>
              <LinearGradient
                pointerEvents="none"
                colors={["rgba(255,255,255,0.34)", "rgba(196,190,181,0.2)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.soundToggleBevel}
              />
              <View style={[styles.soundToggleFill, soundEffectsEnabled && styles.soundToggleFillOn]} />
              <View style={[styles.soundToggleKnob, soundEffectsEnabled && styles.soundToggleKnobOn]}>
                <View pointerEvents="none" style={styles.soundToggleKnobBevel} />
              </View>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Manage data</Text>
          <Text style={styles.cardBody}>Review local storage controls and reset options in a separate screen.</Text>

          <CeramicButton
            size="medium"
            onPress={() => router.push('/manage-data')}
            style={styles.manageDataButton}
            textStyle={styles.manageDataButtonText}
            label="Data & Privacy"
          />
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
    overflow: 'hidden',
    backgroundColor: colors.surface,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
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
  cardBody: {
    ...typography.body,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  inviteBox: {
    borderWidth: 0,
    borderColor: colors.line,
    borderRadius: layout.cardRadius,
    backgroundColor: colors.background,
    marginTop: 12,
    padding: 14,
  },
  inviteLabel: {
    ...typography.instrumentLabel,
    color: colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  inviteCode: {
    fontFamily: typography.valueLarge.fontFamily,
    color: colors.ink,
    fontSize: 24,
    marginTop: 8,
  },
  shareButton: {
    marginTop: 12,
  },
  shareButtonText: {
    ...typography.button,
    color: colors.sage,
    fontSize: 15,
  },
  qrPlaceholder: {
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: colors.line,
    borderRadius: layout.cardRadius,
    backgroundColor: colors.sageSoft,
    marginTop: 12,
  },
  qrText: {
    ...typography.cardTitle,
    color: colors.sage,
    fontSize: 15,
  },
  addFriendBox: {
    marginTop: 14,
  },
  addFriendLabel: {
    ...typography.cardTitle,
    color: colors.ink,
    fontSize: 15,
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  friendInput: {
    ...typography.body,
    flex: 1,
    minHeight: 48,
    borderWidth: 0,
    borderColor: colors.line,
    borderRadius: layout.buttonRadius,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 14,
    paddingHorizontal: 14,
  },
  addButton: {
    minWidth: 72,
  },
  addButtonText: {
    ...typography.button,
    color: colors.sage,
    fontSize: 15,
  },
  friendsList: {
    borderTopWidth: 0,
    borderTopColor: colors.line,
    marginTop: 14,
    paddingTop: 14,
  },
  leaderboardTitle: {
    ...typography.cardTitle,
    color: colors.ink,
    fontSize: 15,
    marginBottom: 2,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 0,
    borderBottomColor: colors.line,
    gap: 10,
    paddingVertical: 12,
  },
  rankBadge: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: colors.sageSoft,
  },
  rankText: {
    ...typography.meta,
    color: colors.sage,
    fontSize: 13,
  },
  friendMain: {
    flex: 1,
  },
  friendName: {
    ...typography.cardTitle,
    color: colors.ink,
    fontSize: 15,
  },
  friendCode: {
    ...typography.meta,
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  friendStats: {
    alignItems: 'flex-end',
  },
  friendPoints: {
    fontFamily: typography.cardTitle.fontFamily,
    color: colors.sage,
    fontSize: 14,
  },
  friendStreak: {
    ...typography.meta,
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  badgeTile: {
    width: '48%',
    minHeight: 92,
    borderWidth: 0,
    borderRadius: 14,
    padding: 12,
  },
  activeBadgeTile: {
    borderColor: colors.sage,
    backgroundColor: colors.sageSoft,
  },
  lockedBadgeTile: {
    borderColor: colors.line,
    backgroundColor: colors.background,
    opacity: 0.72,
  },
  badgeTitle: {
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 13,
  },
  activeBadgeTitle: {
    color: colors.sage,
  },
  lockedBadgeTitle: {
    color: colors.muted,
  },
  badgeDescription: {
    ...typography.body,
    marginTop: 6,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 12,
  },
  settingCopy: {
    flex: 1,
  },
  settingTitle: {
    ...typography.cardTitle,
    color: colors.ink,
    fontSize: 15,
  },
  settingDescription: {
    ...typography.body,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  soundToggle: {
    width: 58,
    height: 34,
    justifyContent: 'center',
    borderWidth: 0,
    borderTopColor: 'rgba(255,255,255,0.74)',
    borderLeftColor: colors.line,
    borderRightColor: colors.line,
    borderBottomColor: 'rgba(31,39,35,0.16)',
    borderRadius: 999,
    backgroundColor: colors.background,
    paddingHorizontal: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  soundToggleOn: {
    backgroundColor: colors.claySoft,
  },
  soundTogglePressed: {
    opacity: 0.9,
    transform: [{ translateY: 1 }, { scale: 0.985 }],
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  soundToggleBevel: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
  },
  soundToggleFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: colors.background,
    opacity: 0.76,
  },
  soundToggleFillOn: {
    backgroundColor: colors.clay,
    opacity: 0.72,
  },
  soundToggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 0,
    borderTopColor: 'rgba(255,255,255,0.95)',
    borderLeftColor: colors.line,
    borderRightColor: colors.line,
    borderBottomColor: 'rgba(31,39,35,0.16)',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  soundToggleKnobBevel: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  soundToggleKnobOn: {
    transform: [{ translateX: 24 }],
  },
  manageDataButton: {
    marginTop: 12,
  },
  manageDataButtonText: {
    ...typography.button,
    color: colors.sage,
    fontSize: 15,
  },
});










