import { colors, elevation, fontFamily, radius } from '@huddle/ui';

/**
 * The attached UI kit's token names mapped onto Huddle's active Soft Minimal
 * palette. The kit remains usable by the screens that came with it, while the
 * app still has one source of truth for actual colours, type, radius, and
 * elevation.
 */
export const huddleUIKitColors = {
  navy: colors.ink,
  orange: colors.accent,
  orangeDark: colors.accent,
  background: colors.canvas,
  surface: colors.surface,
  surfaceSoft: colors.roomSurface,
  textPrimary: colors.ink,
  textSecondary: colors.mutedText,
  textMuted: colors.roomCaption,
  border: colors.border,
  borderStrong: colors.border,
  shadow: colors.ink,
  success: colors.online,
  successBackground: colors.onlineSurface,
  activeBackground: colors.onlineSurface,
  hostBackground: colors.soft,
  away: colors.awayChipText,
  awayBackground: colors.awayChipSurface,
  infoBackground: colors.roomSurface,
  dotInactive: colors.border,
  disabled: colors.away,
} as const;

export const huddleUIKitSpacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const huddleUIKitRadius = {
  sm: radius.chip,
  md: radius.row,
  lg: radius.card,
  xl: radius.card,
  pill: radius.pill,
} as const;

export const huddleUIKitTypography = {
  family: fontFamily.regular,
  regular: fontFamily.regular,
  medium: fontFamily.medium,
  semibold: fontFamily.semibold,
  bold: fontFamily.bold,
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
  },
} as const;

export const huddleUIKitShadow = {
  boxShadow: elevation.phoneSmall,
} as const;
