import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DEFAULT_TIMER_TEST_MODE_ENABLED,
  getTimerTestModeEnabled,
  resetAll,
  resetHistory,
  resetStats,
  saveTimerTestModeEnabled,
} from '../services/storage';
import {
  OPTICAL_LABEL_INSET,
  SCREEN_HORIZONTAL_PADDING,
  colors,
  typography,
} from '../constants/theme';

// ─── Panel geometry (matches rest of app) ────────────────────────────────────

const PANEL_RADIUS      = 22;
const PANEL_GAP_INSET   = 4;
const PANEL_GAP_RADIUS  = PANEL_RADIUS - 2;
const PANEL_INNER_INSET = 6;
const PANEL_INNER_RADIUS = PANEL_RADIUS - 4;

// ─── Sub-components ───────────────────────────────────────────────────────────

function RowDivider() {
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

function ShellButton({
  label,
  onPress,
  disabled,
  destructive,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={disabled ? styles.shellBtnDisabled : undefined}>
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
            <Text style={[styles.shellBtnText, destructive && styles.shellBtnTextDestructive]}>
              {label}
            </Text>
          </LinearGradient>
        </LinearGradient>
      )}
    </Pressable>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

function ShellToggle({
  isOn,
  onPress,
  disabled,
}: {
  isOn: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const knobAnim = useRef(new Animated.Value(isOn ? 28 : 0)).current;

  useEffect(() => {
    Animated.timing(knobAnim, {
      toValue: isOn ? 28 : 0,
      duration: 170,
      useNativeDriver: true,
    }).start();
  }, [isOn, knobAnim]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: isOn, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={disabled ? styles.shellToggleDisabled : undefined}>
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
        <View style={[styles.shellToggleTrack, isOn && styles.shellToggleTrackOn]}>
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
  );
}

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
    title: 'Reset points',
    description: 'Set your total points back to 0. Streak, friends, and history stay intact.',
    buttonLabel: 'Reset',
    confirmTitle: 'Reset total points?',
    confirmMessage: 'Your total points will be set to 0. This cannot be undone.',
  },
  {
    key: 'streak',
    title: 'Reset streak',
    description: 'Set your current daily streak back to 0. Points and history stay intact.',
    buttonLabel: 'Reset',
    confirmTitle: 'Reset streak?',
    confirmMessage: 'Your current streak will be set to 0. This cannot be undone.',
  },
  {
    key: 'history',
    title: 'Reset history',
    description: 'Clear all saved session records. Points, streak, and friends stay intact.',
    buttonLabel: 'Reset',
    confirmTitle: 'Reset session history?',
    confirmMessage: 'Your saved session history will be cleared. This cannot be undone.',
  },
  {
    key: 'all',
    title: 'Reset all data',
    description: 'Clears points, streak, session history, achievements, active session, friends, and invite code.',
    buttonLabel: 'Reset all',
    confirmTitle: 'Reset all data?',
    confirmMessage:
      'This clears points, streak, session history, achievements, any active session, friends, and your invite code. This cannot be undone.',
    isDestructive: true,
  },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ManageDataScreen() {
  const router = useRouter();
  const [isResetting, setIsResetting] = useState(false);
  const [isTestModeEnabled, setIsTestModeEnabled] = useState(DEFAULT_TIMER_TEST_MODE_ENABLED);
  const [isLoadingTestMode, setIsLoadingTestMode] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getTimerTestModeEnabled()
      .then((isEnabled) => {
        if (isMounted) {
          setIsTestModeEnabled(isEnabled);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingTestMode(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const runReset = useCallback(
    async (resetCallback: () => Promise<unknown>) => {
      setIsResetting(true);
      try {
        await resetCallback();
      } finally {
        setIsResetting(false);
      }
    },
    []
  );

  const executeReset = (key: ResetKey) => {
    if (key === 'points')  { void runReset(() => resetStats('points'));  return; }
    if (key === 'streak')  { void runReset(() => resetStats('streak'));  return; }
    if (key === 'history') { void runReset(resetHistory);                return; }
    void runReset(resetAll);
  };

  const confirmReset = (action: ResetAction) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${action.confirmTitle}\n\n${action.confirmMessage}`)) {
        executeReset(action.key);
      }
      return;
    }
    Alert.alert(action.confirmTitle, action.confirmMessage, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action.buttonLabel,
        style: action.isDestructive ? 'destructive' : 'default',
        onPress: () => executeReset(action.key),
      },
    ]);
  };

  const toggleTestMode = () => {
    const nextValue = !isTestModeEnabled;
    setIsTestModeEnabled(nextValue);
    void saveTimerTestModeEnabled(nextValue);
  };

  const regularActions = resetActions.filter((a) => !a.isDestructive);
  const dangerAction   = resetActions.find((a) => a.isDestructive)!;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.pageList}
        contentContainerStyle={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerChrome}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              hitSlop={8}>
              {({ pressed }) => (
                <LinearGradient
                  colors={['#C8C4BA', '#F6F3EC']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.backButtonSeat}>
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(52,47,39,0.30)', 'rgba(52,47,39,0.08)', 'rgba(52,47,39,0.08)', 'rgba(52,47,39,0.24)']}
                    locations={[0, 0.36, 0.64, 1]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.backButtonContactGap}
                  />
                  <View pointerEvents="none" style={styles.backButtonCavity} />
                  <LinearGradient
                    colors={['#FAF8F3', '#DEDAD2']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={[styles.backButtonFace, pressed && styles.backButtonFacePressed]}>
                    <View pointerEvents="none" style={styles.backChevron}>
                      <View style={[styles.backChevronStroke, styles.backChevronStrokeTop]} />
                      <View style={[styles.backChevronStroke, styles.backChevronStrokeBottom]} />
                    </View>
                  </LinearGradient>
                </LinearGradient>
              )}
            </Pressable>

            <Text style={styles.title}>Data & Privacy</Text>
          </View>
          <Text style={styles.subtitle}>All data is stored locally on your device and never sent to a server.</Text>
        </View>

        {/* Prototype controls */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Prototype controls</Text>
          <RecessedPanel>
            <View style={styles.actionRow}>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>Test mode</Text>
                <Text style={styles.actionDesc}>Run timer sessions in 10 seconds for quick demos.</Text>
              </View>
              <ShellToggle
                isOn={isTestModeEnabled}
                onPress={toggleTestMode}
                disabled={isLoadingTestMode}
              />
            </View>
          </RecessedPanel>
        </View>

        {/* Reset options */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Reset options</Text>
          <RecessedPanel>
            {regularActions.map((action, index) => (
              <Fragment key={action.key}>
                {index > 0 && <RowDivider />}
                <View style={styles.actionRow}>
                  <View style={styles.actionCopy}>
                    <Text style={styles.actionTitle}>{action.title}</Text>
                    <Text style={styles.actionDesc}>{action.description}</Text>
                  </View>
                  <ShellButton
                    label={action.buttonLabel}
                    onPress={() => confirmReset(action)}
                    disabled={isResetting}
                  />
                </View>
              </Fragment>
            ))}
          </RecessedPanel>
        </View>

        {/* Danger zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionEyebrow, styles.dangerEyebrow]}>Danger zone</Text>
          <RecessedPanel>
            <View style={styles.actionRow}>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>{dangerAction.title}</Text>
                <Text style={styles.actionDesc}>{dangerAction.description}</Text>
              </View>
              <ShellButton
                label={dangerAction.buttonLabel}
                onPress={() => confirmReset(dangerAction)}
                disabled={isResetting}
                destructive
              />
            </View>
          </RecessedPanel>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

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

  header: {
    gap: 9,
  },
  headerChrome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  backButtonSeat: {
    borderRadius: 999,
    padding: 4,
    overflow: 'hidden',
    position: 'relative',
    marginTop: 7,
  },
  backButtonContactGap: {
    position: 'absolute',
    top: 3,
    right: 3,
    bottom: 3,
    left: 3,
    borderRadius: 999,
  },
  backButtonCavity: {
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
  backButtonFace: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    shadowColor: '#111312',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  backButtonFacePressed: {
    transform: [{ translateY: 1 }, { scale: 0.98 }],
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  backChevron: {
    width: 13,
    height: 18,
    justifyContent: 'center',
    position: 'relative',
    transform: [{ translateX: -2 }],
  },
  backChevronStroke: {
    position: 'absolute',
    left: 2,
    width: 12,
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.sage,
    shadowColor: '#111312',
    shadowOpacity: 0.18,
    shadowRadius: 1.2,
    shadowOffset: { width: 0, height: 1 },
  },
  backChevronStrokeTop: {
    top: 4,
    transform: [{ rotate: '-43deg' }],
  },
  backChevronStrokeBottom: {
    bottom: 4,
    transform: [{ rotate: '43deg' }],
  },
  title: {
    ...typography.screenTitle,
    flex: 1,
    color: colors.ink,
    transform: [{ translateY: 2 }],
  },
  subtitle: {
    ...typography.body,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },

  section: {
    gap: 8,
  },
  sectionEyebrow: {
    ...typography.panelLabel,
    color: colors.sage,
    marginHorizontal: OPTICAL_LABEL_INSET,
    textShadowColor: 'rgba(0,0,0,0.16)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 0.5,
  },
  dangerEyebrow: {
    color: colors.orange,
  },

  // ── Recessed panel ───────────────────────────────────────────────────────────
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
    bottom: 1, left: 0, right: 0,
    height: 1,
    borderRadius: 1,
    zIndex: 3,
  },

  // ── Bevel divider ────────────────────────────────────────────────────────────
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

  // ── Action rows ──────────────────────────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  actionCopy: {
    flex: 1,
    gap: 3,
  },
  actionTitle: {
    ...typography.cardTitle,
    color: colors.ink,
    fontSize: 14,
  },
  actionDesc: {
    ...typography.body,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },

  // ── Shell button ─────────────────────────────────────────────────────────────
  shellBtnDisabled: {
    opacity: 0.45,
  },
  shellBtnOuter: {
    borderRadius: 999,
    padding: 4,
    overflow: 'hidden',
    position: 'relative',
    flexShrink: 0,
  },
  shellBtnContactGap: {
    position: 'absolute',
    top: 3, right: 3, bottom: 3, left: 3,
    borderRadius: 999,
  },
  shellBtnCavity: {
    position: 'absolute',
    top: 4, right: 4, bottom: 4, left: 4,
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
    top: 0, left: 0, right: 0,
    height: 12,
  },
  shellBtnBottomGlint: {
    position: 'absolute',
    right: 8, bottom: 1, left: 8,
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.66)',
  },
  shellBtnText: {
    ...typography.chip,
    color: colors.sage,
    fontSize: 12,
  },
  shellBtnTextDestructive: {
    color: colors.orange,
  },

  shellToggleDisabled: {
    opacity: 0.5,
  },
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
});
