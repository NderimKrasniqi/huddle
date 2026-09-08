/**
 * The spacing rhythm is based on a four-point unit and is shared by Phone and
 * TV.  Values are numbers so they can be used directly in React Native style
 * objects.
 */
export const spacing = {
  none: 0,
  '2xs': 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

export type SpacingToken = keyof typeof spacing;
