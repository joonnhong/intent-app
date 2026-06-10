import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HardwareLed } from '../intent/HardwareLed';
import { SCREEN_HORIZONTAL_PADDING, colors, radius, spacing, typography } from '../../constants/theme';

const PANEL_RADIUS = radius.panel;
const PANEL_INSET = 6;
const PANEL_GAP_INSET = 4;
const PANEL_GAP_RADIUS = PANEL_RADIUS - 2;
const PANEL_INNER_RADIUS = PANEL_RADIUS - 5;

const CONCEPT_ITEMS = [
  'Friend rankings',
  'Shared completed sessions',
  'Points and streak comparison',
  'Accountability together',
];

function ConceptRow({ label }: { label: string }) {
  return (
    <View style={styles.conceptRow}>
      <View style={styles.conceptLedSeat}>
        <HardwareLed isOn={false} size="xs" tone="sage" />
      </View>
      <Text style={styles.conceptText}>{label}</Text>
    </View>
  );
}

export default function FriendsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.pageList}
        contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.logoWrapper}>
            <Text style={styles.logoBevel} numberOfLines={1} importantForAccessibility="no">Friends</Text>
            <Text style={styles.logo} numberOfLines={1}>Friends</Text>
          </View>
          <Text style={styles.headerMeta}>Coming soon</Text>
        </View>

        <LinearGradient
          colors={['#D8D4CB', '#E4E0D8', '#F6F3EC']}
          locations={[0, 0.45, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.panelSeat}>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(52,47,39,0.18)', 'rgba(52,47,39,0.06)', 'rgba(52,47,39,0)']}
            locations={[0, 0.42, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.panelGapTop}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.panelGapBottom}
          />
          <View pointerEvents="none" style={styles.panelCavityShadow} />

          <View style={styles.panelField}>
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(17,19,18,0.08)', 'rgba(17,19,18,0.02)', 'rgba(17,19,18,0)']}
              locations={[0, 0.45, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.panelTopShade}
            />
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.38)', 'rgba(255,255,255,0)']}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.panelBottomGlint}
            />

            <View style={styles.statusRow}>
              <HardwareLed isOn size="small" tone="orange" />
              <Text style={styles.statusText}>Friends update coming soon</Text>
            </View>

            <View style={styles.copyBlock}>
              <Text style={styles.title}>Compare focus progress with friends.</Text>
              <Text style={styles.body}>
                This space is reserved for a future accountability layer around completed focus sessions.
              </Text>
            </View>

            <View style={styles.conceptList}>
              {CONCEPT_ITEMS.map((item) => (
                <ConceptRow key={item} label={item} />
              ))}
            </View>
          </View>
        </LinearGradient>
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
  container: {
    flexGrow: 1,
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    paddingTop: 16,
    paddingBottom: 104,
    gap: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  logoWrapper: {
    position: 'relative',
    flexShrink: 1,
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
  headerMeta: {
    ...typography.panelLabel,
    color: colors.sage,
    paddingTop: 9,
    textAlign: 'right',
  },
  panelSeat: {
    borderRadius: PANEL_RADIUS,
    padding: PANEL_INSET,
    position: 'relative',
  },
  panelGapTop: {
    position: 'absolute',
    top: PANEL_GAP_INSET,
    left: PANEL_GAP_INSET,
    right: PANEL_GAP_INSET,
    height: 30,
    borderTopLeftRadius: PANEL_GAP_RADIUS,
    borderTopRightRadius: PANEL_GAP_RADIUS,
  },
  panelGapBottom: {
    position: 'absolute',
    bottom: PANEL_GAP_INSET,
    left: PANEL_GAP_INSET,
    right: PANEL_GAP_INSET,
    height: 18,
    borderBottomLeftRadius: PANEL_GAP_RADIUS,
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
    shadowOpacity: 0.24,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  panelField: {
    borderRadius: PANEL_INNER_RADIUS,
    backgroundColor: colors.surfaceInset,
    overflow: 'hidden',
    padding: spacing.panelPadding,
    gap: spacing.lg,
    position: 'relative',
    zIndex: 1,
  },
  panelTopShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 42,
  },
  panelBottomGlint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 1,
    height: 1,
    zIndex: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusText: {
    ...typography.panelLabel,
    color: colors.orange,
    flex: 1,
  },
  copyBlock: {
    gap: spacing.sm,
  },
  title: {
    ...typography.cardTitle,
    color: colors.ink,
    fontSize: 22,
    lineHeight: 27,
  },
  body: {
    ...typography.body,
    color: colors.muted,
    maxWidth: 300,
  },
  conceptList: {
    gap: spacing.sm,
  },
  conceptRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  conceptLedSeat: {
    width: 18,
    alignItems: 'center',
  },
  conceptText: {
    ...typography.meta,
    color: colors.muted,
    flex: 1,
  },
});
