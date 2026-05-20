import { LinearGradient } from 'expo-linear-gradient';
import { Fragment } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../constants/theme';
import { CeramicButton } from './CeramicButton';
import { HardwareLed } from './HardwareLed';

const SUMMARY_RADIUS = 22;
const SUMMARY_GAP_INSET = 4;
const SUMMARY_GAP_RADIUS = SUMMARY_RADIUS - 2;
const SUMMARY_INNER_INSET = 6;
const SUMMARY_INNER_RADIUS = SUMMARY_RADIUS - 4;

type ConfirmModalProps = {
  visible: boolean;
  targetTime: string;
  durationLabel: string;
  rewardLabel: string;
  purpose?: string;
  note?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmModal({
  visible,
  targetTime,
  durationLabel,
  rewardLabel,
  purpose,
  note,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Ready to begin?</Text>
          <Text style={styles.title}>Start this detox session</Text>

          <LinearGradient
            colors={['#DEDAD0', '#FDFAF5']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.summarySeat}>
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(52,47,39,0.22)', 'rgba(52,47,39,0.11)', 'rgba(52,47,39,0.036)']}
              locations={[0, 0.5, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.summaryContactGap}
            />
            <View pointerEvents="none" style={styles.summaryCavityShadow} />
            <View style={styles.summaryField}>
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(17,19,18,0.095)', 'rgba(17,19,18,0.032)', 'rgba(17,19,18,0)']}
                locations={[0, 0.42, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.summaryTopShade}
              />
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(52,47,39,0)', 'rgba(52,47,39,0.04)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.summaryBottomDepth}
              />
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.2)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.summaryBottomHighlight}
              />
              {[
                { label: 'Target time', value: targetTime },
                { label: 'Duration',    value: durationLabel },
                ...(purpose ? [{ label: 'Purpose', value: `#${purpose}` }] : []),
                { label: 'Est. reward', value: rewardLabel, valueStyle: styles.rewardValue },
                ...(note    ? [{ label: 'Note',    value: note }]          : []),
              ].map((row, i, arr) => (
                <Fragment key={row.label}>
                  <Row label={row.label} value={row.value} valueStyle={row.valueStyle} />
                  {i < arr.length - 1 && (
                    <>
                      <View style={styles.dividerDark} />
                      <View style={styles.dividerLight} />
                    </>
                  )}
                </Fragment>
              ))}
            </View>
          </LinearGradient>

          <View style={styles.actions}>
            <CeramicButton size="medium" style={{ flex: 2 }} onPress={onCancel}>
              <Text style={styles.cancelText} numberOfLines={1}>Cancel</Text>
            </CeramicButton>
            <CeramicButton size="medium" style={{ flex: 3 }} surfaceStyle={styles.startSurface} onPress={onConfirm}>
              <HardwareLed size="medium" />
              <Text style={styles.startText} numberOfLines={1}>Start session</Text>
            </CeramicButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value, valueStyle }: { label: string; value: string; valueStyle?: object }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueStyle]} numberOfLines={1}>{value}</Text>
    </View>
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
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.card,
    backgroundColor: colors.panel,
    padding: spacing.xl,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  eyebrow: {
    ...typography.panelLabel,
    color: colors.sage,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.16)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 0.5,
  },
  title: {
    fontFamily: typography.screenTitle.fontFamily,
    marginTop: spacing.sm,
    color: 'rgba(17,19,18,0.64)',
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: -1 },
    textShadowRadius: 1,
  },
  summarySeat: {
    width: '100%',
    borderRadius: SUMMARY_RADIUS,
    padding: SUMMARY_INNER_INSET,
    marginTop: spacing.xl,
    position: 'relative',
  },
  summaryContactGap: {
    position: 'absolute',
    top: SUMMARY_GAP_INSET,
    right: SUMMARY_GAP_INSET,
    bottom: SUMMARY_GAP_INSET,
    left: SUMMARY_GAP_INSET,
    borderRadius: SUMMARY_GAP_RADIUS,
  },
  summaryCavityShadow: {
    position: 'absolute',
    top: SUMMARY_GAP_INSET + 1,
    right: SUMMARY_GAP_INSET + 1,
    bottom: SUMMARY_GAP_INSET + 1,
    left: SUMMARY_GAP_INSET + 1,
    borderRadius: SUMMARY_GAP_RADIUS - 1,
    backgroundColor: 'rgba(17,19,18,0.018)',
    shadowColor: '#111312',
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 1, height: 2 },
    elevation: 1,
  },
  summaryField: {
    overflow: 'hidden',
    borderRadius: SUMMARY_INNER_RADIUS,
    backgroundColor: '#E4E0D8',
    paddingHorizontal: 14,
    position: 'relative',
    zIndex: 1,
  },
  summaryTopShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
  },
  summaryBottomDepth: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 18,
  },
  summaryBottomHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  dividerDark: {
    height: 1,
    backgroundColor: 'rgba(17,19,18,0.13)',
    marginHorizontal: -14,
  },
  dividerLight: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.65)',
    marginHorizontal: -14,
  },
  rowLabel: {
    ...typography.meta,
    color: colors.muted,
    fontSize: 13,
  },
  rowValue: {
    fontFamily: typography.cardTitle.fontFamily,
    flexShrink: 1,
    color: 'rgba(17,19,18,0.68)',
    fontSize: 13,
    textAlign: 'right',
  },
  rewardValue: {
    color: colors.sage,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  startSurface: {
    gap: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 20,
  },
  cancelText: {
    ...typography.button,
    color: colors.muted,
    fontSize: 13,
  },
  startText: {
    ...typography.button,
    color: 'rgba(17,19,18,0.68)',
    fontSize: 13,
  },
});
