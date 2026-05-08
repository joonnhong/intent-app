import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { typography } from '../../constants/theme';

type CeramicButtonSize = 'large' | 'largeCompact' | 'medium' | 'small';

type CeramicButtonProps = PressableProps & {
  children?: ReactNode;
  label?: string;
  size?: CeramicButtonSize;
  textStyle?: StyleProp<TextStyle>;
  surfaceStyle?: StyleProp<ViewStyle>;
};

export function CeramicButton({
  children,
  disabled,
  label,
  size = 'medium',
  style,
  textStyle,
  surfaceStyle,
  ...pressableProps
}: CeramicButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      {...pressableProps}
      style={(state: PressableStateCallbackType) => [
        styles.pressable,
        disabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}>
      {(state: PressableStateCallbackType) => {
        const isPressed = state.pressed && !disabled;

        return (
          <LinearGradient
            colors={['#DEDAD0', '#F6F3EC']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.recessedSeat, styles[`${size}Seat`]]}>
            <View
              pointerEvents="none"
              style={[
                styles.contactGap,
                styles[`${size}ContactGap`],
                isPressed && styles.pressedContactGap,
              ]}
            />
            <LinearGradient
              colors={['#F6F3EC', '#DEDAD0']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[
                styles.bevelLayer,
                styles[`${size}Bevel`],
                isPressed && styles.pressedButtonBody,
              ]}>
              <View style={[styles.surface, styles[`${size}Surface`], surfaceStyle]}>
                {children ?? <Text style={[styles.label, styles[`${size}Label`], textStyle]}>{label}</Text>}
              </View>
            </LinearGradient>
          </LinearGradient>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 28,
  },
  disabled: {
    opacity: 0.55,
  },
  recessedSeat: {
    padding: 6,
    borderRadius: 22,
    position: 'relative',
  },
  contactGap: {
    position: 'absolute',
    backgroundColor: 'rgba(34,31,26,0.035)',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  pressedContactGap: {
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 0,
  },
  bevelLayer: {
    justifyContent: 'center',
    borderRadius: 18,
    padding: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  pressedButtonBody: {
    transform: [{ translateY: 2 }, { scale: 0.985 }],
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  surface: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderRadius: 14,
    backgroundColor: '#F0EEE9',
  },
  largeSeat: {
    borderRadius: 22,
  },
  largeContactGap: {
    left: 6,
    right: 6,
    top: 6,
    bottom: 6,
    borderRadius: 18,
  },
  largeBevel: {
    minHeight: 92,
    borderRadius: 18,
  },
  largeSurface: {
    minHeight: 74,
    borderRadius: 14,
    paddingHorizontal: 18,
  },
  largeCompactSeat: {
    borderRadius: 20,
    padding: 5,
  },
  largeCompactContactGap: {
    left: 5,
    right: 5,
    top: 5,
    bottom: 5,
    borderRadius: 16,
  },
  largeCompactBevel: {
    minHeight: 62,
    borderRadius: 16,
    padding: 5,
  },
  largeCompactSurface: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  largeCompactLabel: {
    fontSize: 16,
  },
  mediumSeat: {
    borderRadius: 20,
    padding: 5,
  },
  mediumContactGap: {
    left: 5,
    right: 5,
    top: 5,
    bottom: 5,
    borderRadius: 16,
  },
  mediumBevel: {
    minHeight: 58,
    borderRadius: 16,
    padding: 5,
  },
  mediumSurface: {
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  smallSeat: {
    borderRadius: 999,
    padding: 4,
  },
  smallContactGap: {
    left: 4,
    right: 4,
    top: 4,
    bottom: 4,
    borderRadius: 999,
  },
  smallBevel: {
    minHeight: 34,
    borderRadius: 999,
    padding: 4,
    shadowOpacity: 0.12,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  smallSurface: {
    minHeight: 26,
    borderRadius: 999,
    paddingHorizontal: 10,
  },
  label: {
    ...typography.button,
    color: '#111312',
  },
  largeLabel: {
    fontSize: 17,
  },
  mediumLabel: {
    fontSize: 15,
  },
  smallLabel: {
    fontSize: 12,
  },
});
