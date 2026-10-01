import { brandColors } from './colors';
import { fontFamilies, fontWeights } from './typography';

/**
 * Huddle platform-stage language. These tokens are deliberately separate from
 * the game palettes: the platform is the room, lighting, joining, and handoff
 * layer that surrounds every installed game.
 */
export const platformTheme = {
  colors: {
    ink: '#180F0B',
    inkSoft: 'rgba(24,15,11,0.58)',
    inkFaint: 'rgba(24,15,11,0.28)',
    cream: brandColors.cream,
    gold: '#F4B85B',
    border: 'rgba(249,241,230,0.24)',
    borderStrong: 'rgba(249,241,230,0.46)',
    codeFill: 'rgba(249,241,230,0.96)',
  },
  geometry: {
    width: 1920,
    height: 1080,
    safeX: 96,
    safeY: 54,
    brandLeft: 104,
    brandTop: 68,
    railBottom: 70,
  },
  typography: {
    display: {
      fontFamily: fontFamilies.extraBold,
      fontSize: 62,
      fontWeight: fontWeights.extraBold,
      lineHeight: 72,
    },
    heading: {
      fontFamily: fontFamilies.extraBold,
      fontSize: 54,
      fontWeight: fontWeights.extraBold,
      lineHeight: 64,
    },
    eyebrow: {
      fontFamily: fontFamilies.bold,
      fontSize: 13,
      fontWeight: fontWeights.bold,
      lineHeight: 18,
      letterSpacing: 2.4,
    },
  },
  surfaces: {
    rail: {
      backgroundColor: 'rgba(17,11,8,0.58)',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: 'rgba(249,241,230,0.24)',
    },
    portal: {
      backgroundColor: 'rgba(17,11,8,0.16)',
      borderColor: 'rgba(249,241,230,0.18)',
      borderWidth: 1,
    },
    code: {
      backgroundColor: 'rgba(249,241,230,0.96)',
      borderColor: 'rgba(249,241,230,0.48)',
      borderWidth: 1,
    },
    qr: {
      backgroundColor: brandColors.cream,
    },
  },
} as const;

/**
 * Touch-first platform language for the Phone room, picker, and setup flow.
 * This intentionally stops at the game handoff; running game controllers own
 * their own visual worlds.
 */
export const platformPhoneTheme = {
  colors: {
    canvas: brandColors.cream,
    ink: brandColors.espresso,
    inkSoft: 'rgba(43,31,23,0.68)',
    line: 'rgba(43,31,23,0.16)',
    paper: 'rgba(249,241,230,0.42)',
    primary: brandColors.coral,
    ready: brandColors.mint,
    info: brandColors.sky,
  },
  geometry: {
    maxContentWidth: 460,
    editorialRadius: 6,
    editorialBorderWidth: 2,
  },
} as const;

export type PlatformTheme = typeof platformTheme;
export type PlatformPhoneTheme = typeof platformPhoneTheme;
