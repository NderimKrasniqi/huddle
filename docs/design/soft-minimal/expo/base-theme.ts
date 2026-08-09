/**
 * Huddle shared Expo design tokens.
 * Import this from both the phone and TV applications.
 * No NativeWind/Tailwind dependency.
 */
export const huddleBaseTheme = {
  colors: {
    brand: {
      orange: '#FF6B4A',
      softPeach: '#FFE9DE',
      warmOffWhite: '#FFF7F2',
      deepNavy: '#0F172A',
      sage: '#A7B3A6',
      warmGrey: '#E9E6E2',
    },
    surface: {
      canvas: '#FFF7F2',
      card: '#FFFFFF',
      soft: '#FFE9DE',
      border: '#E9E6E2',
    },
    text: {
      primary: '#0F172A',
      inverse: '#FFFFFF',
    },
    action: {
      primary: '#FF6B4A',
      focus: '#FF6B4A',
      disabledBackground: '#E9E6E2',
    },
    // Supporting semantic colors are implementation values, not brand colors.
    status: {
      online: '#34A853',
      justJoined: '#2D9CDB',
      away: '#A0A4AA',
      host: '#FF6B4A',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 24,
    xl: 32,
    '2xl': 40,
    '3xl': 48,
    '4xl': 64,
    '5xl': 80,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    card: 24,
    pill: 999,
  },
} as const;

export type HuddleBaseTheme = typeof huddleBaseTheme;
