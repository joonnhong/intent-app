import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp, type TextStyle } from 'react-native';

import { colors, typography } from '../../constants/theme';

const ANCHOR_LOGO_ASPECT_RATIO = 822 / 196;
const LOGO_SOURCES = {
  default: require('../../assets/brand/anchor-logo.png'),
  monoBlack: require('../../assets/brand/anchor-logo-mono-black.png'),
} as const;

type AnchorLogoProps = {
  width?: number;
  height?: number;
  variant?: keyof typeof LOGO_SOURCES;
  subtitle?: string;
  style?: StyleProp<ImageStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
};

export function AnchorLogo({
  width = 248,
  height,
  variant = 'default',
  subtitle,
  style,
  subtitleStyle,
}: AnchorLogoProps) {
  const resolvedHeight = height ?? width / ANCHOR_LOGO_ASPECT_RATIO;

  return (
    <View style={styles.root}>
      <Image
        accessibilityIgnoresInvertColors
        accessibilityLabel="Anchor"
        resizeMode="contain"
        source={LOGO_SOURCES[variant]}
        style={[styles.logo, { width, height: resolvedHeight }, style]}
      />
      {subtitle ? <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
  },
  logo: {
    alignSelf: 'center',
  },
  subtitle: {
    ...typography.meta,
    marginTop: 10,
    letterSpacing: 1.2,
    color: colors.muted,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
