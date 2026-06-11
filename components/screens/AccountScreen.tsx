import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { AnchorRulesModal } from '../intent/AnchorRulesModal';
import { EmptyState } from '../intent/EmptyState';
import { HardwareLed } from '../intent/HardwareLed';
import { RollingCounter } from '../intent/RollingCounter';
import {
  OPTICAL_LABEL_INSET,
  SCREEN_HORIZONTAL_PADDING,
  colors,
  typography,
} from '../../constants/theme';

// ─── Panel geometry (matches Dashboard / Recent) ─────────────────────────────

const PANEL_RADIUS       = 22;
const PANEL_GAP_INSET    = 4;
const PANEL_GAP_RADIUS   = PANEL_RADIUS - 2;
const PANEL_INNER_INSET  = 6;
const PANEL_INNER_RADIUS = PANEL_RADIUS - 4;

// ─── Stat card geometry (matches Dashboard MetricCard) ───────────────────────

const STAT_RADIUS       = 20;
const STAT_GAP_INSET    = 4;
const STAT_GAP_RADIUS   = STAT_RADIUS - 2;
const STAT_INNER_INSET  = 6;
const STAT_INNER_RADIUS = STAT_RADIUS - 4;

// ─── Sub-components ───────────────────────────────────────────────────────────

function RowDivider() {
  return (
    <>
      <View style={styles.dividerDark} />
      <View style={styles.dividerLight} />
    </>
  );
}

function ShellButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <LinearGradient
          colors={['#C8C4BA', '#F6F3EC']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.shellBtnOuter}>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(52,47,39,0.30)', 'rgba(52,47,39,0.08)', 'rgba(52,47,39,0.08)', 'rgba(52,47,39,0.24)']}
            locations={[0, 0.36, 0.64, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.shellBtnContactGap}
          />
          <View pointerEvents="none" style={styles.shellBtnCavity} />
          <LinearGradient
            colors={['#FAF8F3', '#DEDAD2']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.shellBtnField, pressed && styles.shellBtnFieldPressed]}>
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
              locations={[0, 0.38, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.shellBtnSheen}
            />
            <View pointerEvents="none" style={styles.shellBtnBottomGlint} />
            <Text style={styles.shellBtnText}>{label}</Text>
          </LinearGradient>
        </LinearGradient>
      )}
    </Pressable>
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

function StatPanel({ label, value, digits = 5, noComma }: { label: string; value: string | number; digits?: number; noComma?: boolean }) {
  return (
    <LinearGradient
      colors={['#DEDAD0', '#FDFAF5']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.statSeat}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(52,47,39,0.22)', 'rgba(52,47,39,0.13)', 'rgba(52,47,39,0.066)', 'rgba(52,47,39,0.024)', 'rgba(52,47,39,0.006)', 'rgba(52,47,39,0)']}
        locations={[0, 0.14, 0.32, 0.55, 0.78, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.statContactGap}
      />
      <View pointerEvents="none" style={styles.statCavityShadow} />
      <View style={styles.statField}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(17,19,18,0.13)', 'rgba(17,19,18,0.05)', 'rgba(17,19,18,0.01)', 'rgba(17,19,18,0)']}
          locations={[0, 0.35, 0.65, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.statTopShade}
        />
        <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
        {typeof value === 'number'
          ? <View style={styles.statCounter}><RollingCounter value={value} digits={digits} noComma={noComma} /></View>
          : <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
        }
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.52)', 'rgba(255,255,255,0.52)', 'rgba(255,255,255,0)']}
          locations={[0, 0.22, 0.78, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.statBottomGlint}
        />
      </View>
    </LinearGradient>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

const emptyStats: Stats = {
  totalPoints: 0,
  currentStreak: 0,
  lastSuccessDate: null,
};

export default function AccountScreen() {
  const router = useRouter();
  const [stats, setStats]           = useState<Stats>(emptyStats);
  const [history, setHistory]       = useState<SessionRecord[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [friends, setFriends]       = useState<Friend[]>([]);
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(true);
  const [isRulesVisible, setIsRulesVisible] = useState(false);
  const knobAnim = useRef(new Animated.Value(soundEffectsEnabled ? 28 : 0)).current;

  useEffect(() => {
    Animated.spring(knobAnim, {
      toValue: soundEffectsEnabled ? 28 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 110,
    }).start();
  }, [soundEffectsEnabled, knobAnim]);

  const refreshAccountData = useCallback(async () => {
    const [nextStats, sessions, nextInviteCode, nextFriends, nextSoundEnabled] = await Promise.all([
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
    setSoundEffectsEnabled(nextSoundEnabled);
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
      return () => { isActive = false; };
    }, [refreshAccountData])
  );

  const shareInviteCode = () => {
    if (!inviteCode) return;
    void Share.share({ message: `Join me on Anchor. My invite code is ${inviteCode}` });
  };

  const toggleSoundEffects = (nextValue: boolean) => {
    setSoundEffectsEnabled(nextValue);
    void saveSoundEffectsEnabled(nextValue);
  };

  const handlePrototypeLogout = () => {
    router.replace('/');
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

  const unlockedCount  = achievements.filter((a) => a.isUnlocked).length;
  const rankedFriends  = [...friends].sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.pageList}
        contentContainerStyle={styles.container}>

        {/* ── Header ────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.logoWrapper}>
            <Text style={styles.logoBevel} importantForAccessibility="no">Account</Text>
            <Text style={styles.logo}>Account</Text>
          </View>
          <HardwareLed size="medium" tone="orange" />
        </View>

        {/* ── Personal Stats ────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Personal Stats</Text>
          <View style={styles.statGrid}>
            <View style={styles.statRow}>
              <StatPanel label="Sessions"   value={history.length}       digits={4} noComma />
              <StatPanel label="Day Streak" value={stats.currentStreak}  digits={4} noComma />
            </View>
            <StatPanel label="Total Points" value={stats.totalPoints}   digits={9} />
          </View>
        </View>

        {/* ── Achievements ──────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Achievements</Text>
          {unlockedCount > 0 ? (
            <RecessedPanel>
              {achievements.filter(a => a.isUnlocked).map((achievement, index) => (
                <Fragment key={achievement.id}>
                  {index > 0 && <RowDivider />}
                  <View style={styles.achievementRow}>
                    <View style={styles.achievementLedCol}>
                      <HardwareLed size="small" tone="sage" isOn />
                    </View>
                    <View style={styles.achievementContent}>
                      <Text style={styles.achievementTitle} numberOfLines={1}>
                        {achievement.title}
                      </Text>
                      <Text style={styles.achievementDesc}>
                        {achievement.description}
                      </Text>
                    </View>
                    <Text style={styles.achievementEarned}>Earned</Text>
                  </View>
                </Fragment>
              ))}
            </RecessedPanel>
          ) : (
            <EmptyState
              title="No achievements yet"
              body="Finish a successful detox session to unlock your first badge."
            />
          )}
        </View>

        {/* ── Friends ───────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Friends</Text>
          <RecessedPanel>
            <View style={styles.inviteCodeRow}>
              <View style={styles.inviteCodeBlock}>
                <Text style={styles.inviteCodeLabel}>Your code</Text>
                <Text style={styles.inviteCodeText} numberOfLines={1}>
                  {inviteCode || 'ANCHOR——'}
                </Text>
              </View>
              <ShellButton label="Share" onPress={shareInviteCode} />
            </View>
            <RowDivider />
            <View style={styles.addFriendRow}>
              <TextInput
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="ANCHOR-AB12CD"
                placeholderTextColor="rgba(102,107,103,0.52)"
                value={friendCodeInput}
                onChangeText={setFriendCodeInput}
                style={styles.addFriendInput}
              />
              <ShellButton label="Add" onPress={addFriend} />
            </View>
            {rankedFriends.length > 0 && (
              <>
                <RowDivider />
                {rankedFriends.map((friend, index) => (
                  <Fragment key={friend.id}>
                    {index > 0 && <RowDivider />}
                    <View style={styles.friendRow}>
                      <View style={styles.rankBadge}>
                        <Text style={styles.rankText}>{index + 1}</Text>
                      </View>
                      <View style={styles.friendMain}>
                        <Text style={styles.friendName}>{friend.displayName}</Text>
                        <Text style={styles.friendMeta}>{friend.inviteCode}</Text>
                      </View>
                      <View style={styles.friendStats}>
                        <Text style={styles.friendPoints}>{friend.totalPoints} pts</Text>
                        <Text style={styles.friendStreak}>{friend.currentStreak}d streak</Text>
                      </View>
                    </View>
                  </Fragment>
                ))}
              </>
            )}
          </RecessedPanel>
        </View>

        {/* ── Settings ──────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Settings</Text>
          <RecessedPanel>
            <View style={styles.settingRow}>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Sound effects</Text>
                <Text style={styles.settingDesc}>Gentle sounds for results and penalties.</Text>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: soundEffectsEnabled }}
                onPress={() => toggleSoundEffects(!soundEffectsEnabled)}>
                <LinearGradient
                  colors={['#C8C4BA', '#F6F3EC']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.shellToggleOuter}>
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(52,47,39,0.30)', 'rgba(52,47,39,0.08)', 'rgba(52,47,39,0.08)', 'rgba(52,47,39,0.24)']}
                    locations={[0, 0.36, 0.64, 1]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.shellToggleContactGap}
                  />
                  <View pointerEvents="none" style={styles.shellToggleCavity} />
                  <View style={[styles.shellToggleTrack, soundEffectsEnabled && styles.shellToggleTrackOn]}>
                    <Animated.View style={[styles.shellToggleKnob, { transform: [{ translateX: knobAnim }] }]}>
                      <LinearGradient
                        pointerEvents="none"
                        colors={['#FAF8F3', '#DEDAD2']}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={StyleSheet.absoluteFillObject}
                      />
                      <LinearGradient
                        pointerEvents="none"
                        colors={['rgba(255,255,255,0.62)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
                        locations={[0, 0.38, 1]}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={StyleSheet.absoluteFillObject}
                      />
                      <View pointerEvents="none" style={styles.shellToggleKnobBevel} />
                    </Animated.View>
                  </View>
                </LinearGradient>
              </Pressable>
            </View>
            <RowDivider />
            <View style={styles.settingRow}>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>How Anchor works</Text>
                <Text style={styles.settingDesc}>Scoring, penalties, movement, and prototype mode.</Text>
              </View>
              <ShellButton label="Open" onPress={() => setIsRulesVisible(true)} />
            </View>
            <RowDivider />
            <View style={styles.settingRow}>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Data & Privacy</Text>
                <Text style={styles.settingDesc}>Local storage controls and reset options.</Text>
              </View>
              <ShellButton label="Manage" onPress={() => router.push('/manage-data')} />
            </View>
            <RowDivider />
            <View style={styles.settingRow}>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Prototype session</Text>
                <Text style={styles.settingDesc}>Return to the entry screen without clearing local data.</Text>
              </View>
              <ShellButton label="Log out" onPress={handlePrototypeLogout} />
            </View>
          </RecessedPanel>
        </View>

      </ScrollView>
      <AnchorRulesModal visible={isRulesVisible} onClose={() => setIsRulesVisible(false)} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // Page
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pageList: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 14,
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
  subtitle: {
    ...typography.body,
    color: colors.muted,
    fontSize: 14,
    marginTop: 6,
  },

  // Section wrapper
  section: {
    gap: 8,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionEyebrow: {
    ...typography.panelLabel,
    color: colors.sage,
    marginHorizontal: OPTICAL_LABEL_INSET,
    textShadowColor: 'rgba(0,0,0,0.16)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 0.5,
  },
  sectionCount: {
    ...typography.meta,
    color: colors.muted,
    fontSize: 11,
  },

  // ── Recessed panel ──────────────────────────────────────────────────────────
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
    left: 0, right: 0,
    height: 1,
    borderRadius: 1,
    zIndex: 3,
  },
  // Beveled groove divider
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

  // ── Stat cards (matches Dashboard MetricCard) ────────────────────────────────
  statGrid: {
    gap: 10,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statSeat: {
    flex: 1,
    borderRadius: STAT_RADIUS,
    padding: STAT_INNER_INSET,
    position: 'relative',
  },
  statContactGap: {
    position: 'absolute',
    top: STAT_GAP_INSET,
    right: STAT_GAP_INSET,
    bottom: STAT_GAP_INSET,
    left: STAT_GAP_INSET,
    borderRadius: STAT_GAP_RADIUS,
  },
  statCavityShadow: {
    position: 'absolute',
    top: STAT_GAP_INSET + 1,
    right: STAT_GAP_INSET + 1,
    bottom: STAT_GAP_INSET + 1,
    left: STAT_GAP_INSET + 1,
    borderRadius: STAT_GAP_RADIUS - 1,
    backgroundColor: 'rgba(17,19,18,0.018)',
    shadowColor: '#111312',
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 1, height: 2 },
    elevation: 1,
  },
  statField: {
    borderRadius: STAT_INNER_RADIUS,
    backgroundColor: '#E4E0D8',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  statTopShade: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 22,
    zIndex: 2,
    pointerEvents: 'none',
  },
  statBottomGlint: {
    position: 'absolute',
    bottom: 1,
    left: 0, right: 0,
    height: 1,
    borderRadius: 1,
    zIndex: 3,
  },
  statLabel: {
    ...typography.meta,
    color: colors.muted,
    fontSize: 11,
  },
  statCounter: {
    marginTop: 8,
  },
  statValue: {
    fontFamily: typography.valueLarge.fontFamily,
    color: colors.ink,
    fontSize: 24,
    marginTop: 5,
    lineHeight: 28,
  },

  // ── Achievement rows ─────────────────────────────────────────────────────────
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  achievementLedCol: {
    paddingTop: 1,
  },
  achievementContent: {
    flex: 1,
    gap: 3,
  },
  achievementTitle: {
    ...typography.cardTitle,
    color: colors.ink,
    fontSize: 14,
  },
  achievementTitleLocked: {
    color: colors.muted,
  },
  achievementDesc: {
    ...typography.meta,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  achievementDescLocked: {
    opacity: 0.65,
  },
  achievementEarned: {
    ...typography.chip,
    color: colors.sage,
    fontSize: 11,
    paddingTop: 2,
  },

  // ── Invite code ──────────────────────────────────────────────────────────────
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  inviteCodeBlock: {
    flex: 1,
  },
  inviteCodeLabel: {
    ...typography.meta,
    color: colors.muted,
    fontSize: 11,
  },
  inviteCodeText: {
    fontFamily: typography.valueLarge.fontFamily,
    color: colors.ink,
    fontSize: 17,
    letterSpacing: 0.5,
    marginTop: 3,
  },
  // ── Add friend ───────────────────────────────────────────────────────────────
  addFriendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  addFriendInput: {
    ...typography.body,
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    height: 34,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  // ── Leaderboard rows ─────────────────────────────────────────────────────────
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  rankBadge: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: 'rgba(79,125,112,0.12)',
  },
  rankText: {
    fontFamily: typography.meta.fontFamily,
    color: colors.sage,
    fontSize: 12,
  },
  friendMain: {
    flex: 1,
  },
  friendName: {
    ...typography.cardTitle,
    color: colors.ink,
    fontSize: 14,
  },
  friendMeta: {
    ...typography.meta,
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  friendStats: {
    alignItems: 'flex-end',
  },
  friendPoints: {
    fontFamily: typography.cardTitle.fontFamily,
    color: colors.sage,
    fontSize: 13,
  },
  friendStreak: {
    ...typography.meta,
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },

  // ── Settings ─────────────────────────────────────────────────────────────────
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 12,
  },
  settingCopy: {
    flex: 1,
  },
  // ── Shell button (digit-wheel housing style) ─────────────────────────────────
  shellBtnOuter: {
    borderRadius: 999,
    padding: 4,
    overflow: 'hidden',
    position: 'relative',
    flexShrink: 0,
  },
  shellBtnContactGap: {
    position: 'absolute',
    top: 3,
    right: 3,
    bottom: 3,
    left: 3,
    borderRadius: 999,
  },
  shellBtnCavity: {
    position: 'absolute',
    top: 4,
    right: 4,
    bottom: 4,
    left: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(17,19,18,0.018)',
    shadowColor: '#111312',
    shadowOpacity: 0.14,
    shadowRadius: 3,
    shadowOffset: { width: 1, height: 2 },
    elevation: 1,
  },
  shellBtnField: {
    overflow: 'hidden',
    borderRadius: 999,
    position: 'relative',
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  shellBtnFieldPressed: {
    transform: [{ translateY: 1 }, { scale: 0.97 }],
  },
  shellBtnSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 12,
  },
  shellBtnBottomGlint: {
    position: 'absolute',
    right: 8,
    bottom: 1,
    left: 8,
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.66)',
  },
  shellBtnText: {
    ...typography.chip,
    color: colors.sage,
    fontSize: 12,
  },

  // ── Shell toggle (digit-wheel housing style) ──────────────────────────────────
  shellToggleOuter: {
    width: 64,
    height: 36,
    borderRadius: 999,
    padding: 4,
    overflow: 'hidden',
    position: 'relative',
    flexShrink: 0,
  },
  shellToggleContactGap: {
    position: 'absolute',
    top: 3,
    right: 3,
    bottom: 3,
    left: 3,
    borderRadius: 999,
  },
  shellToggleCavity: {
    position: 'absolute',
    top: 4,
    right: 4,
    bottom: 4,
    left: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(17,19,18,0.018)',
    shadowColor: '#111312',
    shadowOpacity: 0.14,
    shadowRadius: 3,
    shadowOffset: { width: 1, height: 2 },
    elevation: 1,
  },
  shellToggleTrack: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: '#BFBBB3',
    position: 'relative',
  },
  shellToggleTrackOn: {
    backgroundColor: '#6FA49C',
  },
  shellToggleKnob: {
    position: 'absolute',
    left: 3,
    top: 3,
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  shellToggleKnobBevel: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },

  settingTitle: {
    ...typography.cardTitle,
    color: colors.ink,
    fontSize: 15,
  },
  settingDesc: {
    ...typography.body,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
});
