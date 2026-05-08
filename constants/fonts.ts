export const fonts = {
  sansRegular: 'GeistRegular',
  sansMedium: 'GeistMedium',
  sansBold: 'GeistBold',
  sansBlack: 'GeistBlack',
  monoRegular: 'GeistMonoRegular',
  monoMedium: 'GeistMonoMedium',
  monoBold: 'GeistMonoBold',
} as const;

export const fontAssets = {
  GeistRegular: require('../assets/fonts/Geist/Geist-Regular.otf'),
  GeistMedium: require('../assets/fonts/Geist/Geist-Medium.otf'),
  GeistBold: require('../assets/fonts/Geist/Geist-Bold.otf'),
  GeistBlack: require('../assets/fonts/Geist/Geist-Black.otf'),
  GeistMonoRegular: require('../assets/fonts/GeistMono/GeistMono-Regular.otf'),
  GeistMonoMedium: require('../assets/fonts/GeistMono/GeistMono-Medium.otf'),
  GeistMonoBold: require('../assets/fonts/GeistMono/GeistMono-Bold.otf'),
} as const;

export const navigationFonts = {
  regular: {
    fontFamily: fonts.sansRegular,
    fontWeight: '400' as const,
  },
  medium: {
    fontFamily: fonts.sansMedium,
    fontWeight: '500' as const,
  },
  bold: {
    fontFamily: fonts.sansBold,
    fontWeight: '700' as const,
  },
  heavy: {
    fontFamily: fonts.sansBlack,
    fontWeight: '900' as const,
  },
} as const;
