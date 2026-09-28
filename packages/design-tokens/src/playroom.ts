import { fontFamilies } from './typography';

/**
 * Playroom, the Huddle platform design system
 * (docs/design/playroom/README.md, from the Huddle-Platform tokens.json):
 * warm canvas, deep-purple ink, orange accents, Nunito.
 *
 * Game modules do not consume these; each game owns its own theme.
 */
export const playroomColors = {
  /** The page. */
  canvas: '#F9F1E6',
  /** Cards and raised surfaces. */
  surface: '#FFFCF7',
  /** Normal text, and primary buttons (with canvas text). */
  ink: '#2D0B4E',
  muted: '#6D5B79',
  /** Accent buttons (with ink text), burst dashes, host tags. */
  orange: '#FF781F',
  /** Selection, with an ink border and a check. */
  lavender: '#E3D9FF',
  border: '#D8CCDF',
  success: '#286447',
  successSurface: '#D4F1CC',
  danger: '#A52C44',
  dangerSurface: '#FFE0E5',
  disabled: '#E5DEE9',
} as const;

export type PlayroomColor = keyof typeof playroomColors;

/**
 * The pastel circle drawn behind each avatar portrait, keyed by stable avatar
 * id (portraits ship without circles). An away player's circle turns grey.
 */
export const playroomAvatarCircles = {
  fox: '#FFCCA5',
  'green-alien': '#D4F1CC',
  'pink-bunny': '#FFD8E3',
  'blue-robot': '#E3D9FF',
  'purple-owl': '#F4CEE4',
  'yellow-robot': '#D8DCFF',
  'red-robot': '#FFE0C2',
  'teal-bear': '#F8E7BC',
  'mint-cat': '#FFF0B3',
  puppy: '#D2F0D5',
} as const;

export const playroomAwayCircle = '#DDD9DF';

/** Nunito: regular for paragraphs, bold for labels, extra-bold for headings. */
export const playroomFonts = {
  body: fontFamilies.regular,
  label: fontFamilies.bold,
  heading: fontFamilies.extraBold,
} as const;

/** Spacing scale in logical units (phone) or stage units (TV). */
export const playroomSpacing = [4, 8, 12, 16, 24, 32, 48, 64, 96] as const;

export const playroomRadii = {
  input: 16,
  button: 20,
  card: 28,
  pill: 999,
} as const;

/**
 * The TV stage is drawn at 1920×1080 and scaled uniformly to the screen,
 * inside a 96 × 54 overscan-safe inset. Sizes are stage units.
 */
export const playroomTv = {
  width: 1920,
  height: 1080,
  safeX: 96,
  safeY: 54,
  wordmarkHeight: 72,
  type: {
    caption: { fontFamily: fontFamilies.bold, fontSize: 24, lineHeight: 32 },
    body: { fontFamily: fontFamilies.regular, fontSize: 32, lineHeight: 42 },
    label: { fontFamily: fontFamilies.bold, fontSize: 32, lineHeight: 42 },
    heading: { fontFamily: fontFamilies.extraBold, fontSize: 56, lineHeight: 64 },
    hero: { fontFamily: fontFamilies.extraBold, fontSize: 80, lineHeight: 88 },
    roomCode: { fontFamily: fontFamilies.extraBold, fontSize: 96, lineHeight: 104, letterSpacing: 12 },
    countdown: { fontFamily: fontFamilies.extraBold, fontSize: 240, lineHeight: 250 },
  },
  avatar: { grid: 150, row: 112, ready: 150, mini: 80 },
} as const;

/** Phone sizes in logical units; font scaling stays on and labels wrap. */
export const playroomPhone = {
  gutter: 16,
  sectionGap: 24,
  minTarget: 48,
  buttonHeight: 52,
  type: {
    caption: { fontFamily: fontFamilies.bold, fontSize: 14, lineHeight: 20 },
    body: { fontFamily: fontFamilies.regular, fontSize: 16, lineHeight: 24 },
    label: { fontFamily: fontFamilies.bold, fontSize: 16, lineHeight: 24 },
    heading: { fontFamily: fontFamilies.extraBold, fontSize: 28, lineHeight: 34 },
    hero: { fontFamily: fontFamilies.extraBold, fontSize: 36, lineHeight: 42 },
    code: { fontFamily: fontFamilies.extraBold, fontSize: 36, lineHeight: 42, letterSpacing: 6 },
  },
  avatar: { tile: 48, feature: 140, identity: 58 },
} as const;

/** Static, lightweight shadows; never animated. */
export const playroomShadows = {
  card: {
    shadowColor: playroomColors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;

/**
 * Playroom motion in milliseconds. Reduced motion removes scale, travel,
 * bounce, and decorative loops; state changes stay immediate or fade briefly.
 * Nothing bobs forever behind essential information.
 */
export const playroomMotion = {
  /** Press feedback: a subtle scale to `pressScale`. */
  press: 100,
  pressScale: 0.98,
  /** Standard opacity or translation change. */
  transition: 180,
  /** An element arriving, with at most `entranceTravel` units of movement. */
  entrance: 240,
  entranceTravel: 12,
  /** Delay between items when a grid first appears. */
  stagger: 40,
  /** How long a changed setting stays highlighted on the TV. */
  highlight: 600,
  /** One countdown step; the timer itself follows the server deadline. */
  tick: 1000,
} as const;

/** Cubic-bezier control points; `Easing.bezier(...playroomEasing.out)`. */
export const playroomEasing = {
  /** Entering and exiting: starts fast, so it feels responsive. */
  out: [0.23, 1, 0.32, 1],
  /** Moving on screen. */
  inOut: [0.77, 0, 0.175, 1],
} as const;
