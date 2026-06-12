import { LinearGradient } from 'expo-linear-gradient';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../constants/theme';
import { CeramicButton } from './CeramicButton';
import { HardwareLed } from './HardwareLed';

const RULE_SECTIONS = [
  {
    title: 'Focus sessions',
    body: 'Choose a session length, place your phone down, and let the timer run. Anchor rewards completed stillness.',
    tone: 'sage' as const,
  },
  {
    title: 'Points',
    body: 'Completing a session earns the full base reward. Longer sessions scale up, with the base session reward capped at 999 points before streak bonuses.',
    tone: 'sage' as const,
  },
  {
    title: 'Movement',
    body: 'When movement is detected, Anchor starts a warning. If movement continues for 5 seconds, the session receives 1 penalty.',
    tone: 'orange' as const,
  },
  {
    title: 'Penalties',
    body: 'Each penalty adds 15% of the selected session length to the timer. On the 5th penalty, the session force-ends with partial reward.',
    tone: 'orange' as const,
  },
  {
    title: 'Demo mode',
    body: 'This prototype may shorten session length for demo purposes so session flows can be previewed quickly.',
    tone: 'neutral' as const,
  },
];

type AnchorRulesModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function AnchorRulesModal({ visible, onClose }: AnchorRulesModalProps) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerLed}>
              <HardwareLed isOn size="small" tone="orange" />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>Anchor rules</Text>
              <Text style={styles.title}>How Anchor works</Text>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled">
            <Text style={styles.intro}>
              Anchor turns focus into a physical ritual: set an intention, put the phone down, and let stillness carry the session.
            </Text>

            {RULE_SECTIONS.map((section) => (
              <LinearGradient
                key={section.title}
                colors={['#DEDAD0', '#FDFAF5']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.ruleSeat}>
                <LinearGradient
                  pointerEvents="none"
                  colors={['rgba(52,47,39,0.2)', 'rgba(52,47,39,0.08)', 'rgba(52,47,39,0.03)']}
                  locations={[0, 0.5, 1]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.ruleContactGap}
                />
                <View style={styles.ruleField}>
                  <View style={styles.ruleHeader}>
                    <HardwareLed
                      isOn={section.tone !== 'neutral'}
                      size="small"
                      tone={section.tone === 'sage' ? 'sage' : 'orange'}
                    />
                    <Text style={styles.ruleTitle}>{section.title}</Text>
                  </View>
                  <Text style={styles.ruleBody}>{section.body}</Text>
                </View>
              </LinearGradient>
            ))}
          </ScrollView>

          <View pointerEvents="none" style={styles.footerBand} />

          <CeramicButton size="medium" onPress={onClose} surfaceStyle={styles.closeSurface}>
            <Text style={styles.closeText}>Close</Text>
          </CeramicButton>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,19,18,0.42)',
    padding: spacing.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 390,
    maxHeight: '86%',
    borderRadius: radius.panel,
    backgroundColor: colors.panel,
    padding: spacing.lg,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerLed: {
    width: 30,
    alignItems: 'center',
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    ...typography.panelLabel,
    color: colors.sage,
  },
  title: {
    fontFamily: typography.screenTitle.fontFamily,
    marginTop: 3,
    color: colors.ink,
    fontSize: 25,
    lineHeight: 30,
  },
  content: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  intro: {
    ...typography.body,
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  ruleSeat: {
    borderRadius: 18,
    padding: 5,
    position: 'relative',
  },
  ruleContactGap: {
    position: 'absolute',
    top: 4,
    right: 4,
    bottom: 4,
    left: 4,
    borderRadius: 14,
  },
  ruleField: {
    borderRadius: 13,
    backgroundColor: '#E4E0D8',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 5,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ruleTitle: {
    ...typography.cardTitle,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 20,
  },
  ruleBody: {
    ...typography.body,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  footerBand: {
    height: 1,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    borderRadius: 1,
    backgroundColor: colors.background,
  },
  closeSurface: {
    paddingHorizontal: spacing.lg,
  },
  closeText: {
    ...typography.button,
    color: colors.sage,
  },
});
