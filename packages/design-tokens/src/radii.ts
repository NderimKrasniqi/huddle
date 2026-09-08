/** Corner recipes for cards, controls, and the rounded Heartbeat mark. */
export const radii = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
  round: 9999,
} as const;

export type RadiusToken = keyof typeof radii;
