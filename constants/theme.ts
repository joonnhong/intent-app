import { Platform } from 'react-native';

import { fonts } from './fonts';

export const colors = {
  background: '#F0EEE9',
  panel: '#F0EEE9',
  surface: '#F0EEE9',
  surfaceInset: '#E4E1DA',
  ink: '#111312',
  muted: '#666B67',
  faint: '#9A9D99',
  line: 'rgba(17,19,18,0.08)',
  sage: '#4F7D70',
  orange: '#FF5A2D',
  yellow: '#EAB308',
  successSoft: '#E3E9E2',
  warningSoft: '#EADDD5',
  sageSoft: '#E3E9E2',
  clay: '#B8664B',
  claySoft: '#EADDD5',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  screenPadding: 20,
  panelPadding: 18,
  cardGap: 14,
  controlGap: 10,
} as const;

export const radius = {
  panel: 28,
  card: 22,
  control: 16,
  button: 18,
  smallButton: 12,
  pill: 999,
  dial: 999,
} as const;

export const typography = {
  screenTitle: {
    fontFamily: fonts.sansBlack,
    fontSize: 30,
    lineHeight: 34,
    color: colors.ink,
  },
  panelLabel: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  valueLarge: {
    fontFamily: fonts.sansBlack,
    fontSize: 48,
    lineHeight: 52,
    color: colors.ink,
  },
  timerValue: {
    fontFamily: fonts.sansBlack,
    fontSize: 54,
    lineHeight: 58,
    letterSpacing: 0.1,
    color: colors.ink,
  },
  cardTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  meta: {
    fontFamily: fonts.monoMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.35,
    color: colors.muted,
  },
  button: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.2,
  },
  chip: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.15,
  },
  instrumentLabel: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
} as const;

export const shadows = {
  panel: {
    shadowColor: '#000000',
    shadowOpacity: 0.09,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  raisedControl: {
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  button: {
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  pressed: {
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  dial: {
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
} as const;

export const theme = {
  colors,
  fonts,
  spacing,
  radius,
  typography,
  shadows,
} as const;

// Backward-compatible exports for Expo template hooks that still read Colors/Fonts.
export const Colors = {
  light: {
    text: colors.ink,
    background: colors.background,
    tint: colors.sage,
    icon: colors.muted,
    tabIconDefault: colors.faint,
    tabIconSelected: colors.sage,
  },
  dark: {
    text: colors.surface,
    background: colors.background,
    tint: colors.surface,
    icon: colors.faint,
    tabIconDefault: colors.faint,
    tabIconSelected: colors.surface,
  },
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: fonts.sansRegular,
    serif: 'ui-serif',
    rounded: fonts.sansMedium,
    mono: fonts.monoRegular,
  },
  default: {
    sans: fonts.sansRegular,
    serif: 'serif',
    rounded: fonts.sansMedium,
    mono: fonts.monoRegular,
  },
  web: {
    sans: fonts.sansRegular,
    serif: "Georgia, 'Times New Roman', serif",
    rounded: fonts.sansMedium,
    mono: fonts.monoRegular,
  },
});

export { fonts };
