/**
 * Face names match the aliases exported by `@expo-google-fonts/nunito`.
 * Weight-specific families avoid platform-dependent synthetic bolding.
 */
export const fontFamilies = {
  regular: 'Nunito_400Regular',
  bold: 'Nunito_700Bold',
  extraBold: 'Nunito_800ExtraBold',
} as const;

/** React Native accepts font weights as these string values. */
export const fontWeights = {
  regular: '400',
  bold: '700',
  extraBold: '800',
} as const;

export const fontSizes = {
  caption: 12,
  body: 16,
  bodyLarge: 18,
  title: 24,
  display: 40,
  hero: 56,
  tvDisplay: 72,
} as const;

export const lineHeights = {
  caption: 16,
  body: 24,
  bodyLarge: 28,
  title: 30,
  display: 48,
  hero: 64,
  tvDisplay: 80,
} as const;

/**
 * Ready-to-spread React Native text styles.  Keeping these as plain objects
 * means consumers can pass them directly to a `Text` style array.
 */
export const typography = {
  caption: {
    fontFamily: fontFamilies.bold,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.caption,
  },
  body: {
    fontFamily: fontFamilies.regular,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.body,
  },
  bodyLarge: {
    fontFamily: fontFamilies.regular,
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.bodyLarge,
  },
  title: {
    fontFamily: fontFamilies.extraBold,
    fontSize: fontSizes.title,
    fontWeight: fontWeights.extraBold,
    lineHeight: lineHeights.title,
  },
  display: {
    fontFamily: fontFamilies.extraBold,
    fontSize: fontSizes.display,
    fontWeight: fontWeights.extraBold,
    lineHeight: lineHeights.display,
  },
  hero: {
    fontFamily: fontFamilies.extraBold,
    fontSize: fontSizes.hero,
    fontWeight: fontWeights.extraBold,
    lineHeight: lineHeights.hero,
  },
  tvDisplay: {
    fontFamily: fontFamilies.extraBold,
    fontSize: fontSizes.tvDisplay,
    fontWeight: fontWeights.extraBold,
    lineHeight: lineHeights.tvDisplay,
  },
} as const;

export type TypographyToken = keyof typeof typography;
