/**
 * Voting's own colours, spacing and corner radii. The game keeps these values
 * locally so it never depends on the Huddle platform's design tokens.
 */
export const votingPalette = {
  butter: '#FFD766',
  coral: '#FF6F61',
  cream: '#F9F1E6',
  dustyRose: '#E6A3B1',
  espresso: '#2B1F17',
  mint: '#7FD2B6',
  sky: '#7CC6FF',
} as const;

/** Spacing scale in logical units (phone) or stage units (TV). */
export const votingSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
} as const;

export const votingRadii = {
  lg: 16,
} as const;
