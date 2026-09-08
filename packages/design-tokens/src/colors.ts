/**
 * Heartbeat's small, intentional palette.
 *
 * Keep the primitive names stable so artwork, native components, and product
 * surfaces can all refer to the same values.
 */
export const brandColors = {
  cream: '#F9F1E6',
  espresso: '#2B1F17',
  coral: '#FF6F61',
  butter: '#FFD766',
  mint: '#7FD2B6',
  sky: '#7CC6FF',
  lilac: '#C8B6FF',
  dustyRose: '#E6A3B1',
} as const;

/** Semantic roles intentionally resolve to a brand primitive. */
export const semanticColors = {
  background: brandColors.cream,
  surface: brandColors.cream,
  surfaceRaised: brandColors.cream,
  text: brandColors.espresso,
  textOnBrand: brandColors.espresso,
  primary: brandColors.coral,
  primaryText: brandColors.espresso,
  secondary: brandColors.butter,
  success: brandColors.mint,
  info: brandColors.sky,
  accent: brandColors.lilac,
  highlight: brandColors.dustyRose,
  border: brandColors.espresso,
} as const;

export type BrandColor = keyof typeof brandColors;
export type SemanticColor = keyof typeof semanticColors;
