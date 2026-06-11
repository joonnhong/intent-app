import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, type PressableProps, type PressableStateCallbackType } from 'react-native';

import { colors, typography } from '../../constants/theme';

type InfoButtonProps = PressableProps & {
  label?: string;
};

export function InfoButton({ label = '?', style, ...pressableProps }: InfoButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="How Anchor works"
      hitSlop={8}
      {...pressableProps}
      style={(state: PressableStateCallbackType) => [
        styles.pressable,
        state.pressed && styles.pressablePressed,
        typeof style === 'function' ? style(state) : style,
      ]}>
      <LinearGradient
        colors={['#DEDAD0', '#FDFAF5']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.seat}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(52,47,39,0.22)', 'rgba(52,47,39,0.08)', 'rgba(52,47,39,0.05)']}
          locations={[0, 0.52, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.contactGap}
        />
        <LinearGradient
          colors={['#FAF8F3', '#DEDAD2']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.buttonFace}>
          <Text style={styles.label}>{label}</Text>
        </LinearGradient>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  pressablePressed: {
    transform: [{ translateY: 1 }, { scale: 0.985 }],
  },
  seat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    padding: 3,
    position: 'relative',
  },
  contactGap: {
    position: 'absolute',
    top: 3,
    right: 3,
    bottom: 3,
    left: 3,
    borderRadius: 11,
    shadowColor: '#111312',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  buttonFace: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    shadowColor: '#111312',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  label: {
    ...typography.meta,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'center',
  },
});
