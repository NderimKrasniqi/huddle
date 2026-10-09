import { fontFamilies } from './typography';

/**
 * Playroom, the Huddle platform design system
 * (docs/design/playroom/README.md, from the Huddle-Platform tokens.json):
 * warm canvas, deep-purple ink, orange accents, Nunito.
 *
 * Three rules follow the concept boards rather than the spec: headings use
 * Nunito Black and run larger, the primary button is orange, and screens are
 * framed by cohesive lounge artwork and quieter controls.
 *
 * Game modules do not consume these; each game owns its own theme.
 */
export const playroomColors = {
  /** The page. */
  canvas: '#F9F1E6',
  /** Cards and raised surfaces. */
  surface: '#FFFCF7',
  /** Normal text, and the text on orange buttons. */
  ink: '#2D0B4E',
  muted: '#6D5B79',
  /** Primary buttons (with ink text), burst dashes, host tags. */
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

/** Ink at 35%: the dim behind a sheet or modal. */
export const playroomScrim = 'rgba(45, 11, 78, 0.35)';

/** Ink at 18%: the pressed-in lower edge of a primary button. */
export const playroomButtonEdge = 'rgba(45, 11, 78, 0.18)';

/** Shelf cover colours belong to platform presentation, not game themes. */
export const playroomCoverColors: Readonly<Record<string, string>> = {
  trivia: '#DED2FF', 'bomb-squad': '#CFEBDC',
};

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

/** Nunito: regular for paragraphs, bold for labels, black for headings. */
export const playroomFonts = {
  body: fontFamilies.regular,
  label: fontFamilies.bold,
  strong: fontFamilies.extraBold,
  heading: fontFamilies.black,
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
    /** Card titles and values. */
    title: { fontFamily: fontFamilies.extraBold, fontSize: 56, lineHeight: 64 },
    heading: { fontFamily: fontFamilies.black, fontSize: 84, lineHeight: 92 },
    hero: { fontFamily: fontFamilies.black, fontSize: 104, lineHeight: 112 },
    roomCode: { fontFamily: fontFamilies.black, fontSize: 96, lineHeight: 104 },
    countdown: { fontFamily: fontFamilies.black, fontSize: 384, lineHeight: 400 },
    /** The selected game's name on the shelf: between heading and hero. */
    feature: { fontFamily: fontFamilies.black, fontSize: 76, lineHeight: 84 },
    /** One letter of the room code in its tile. */
    codeTile: { fontFamily: fontFamilies.black, fontSize: 132, lineHeight: 140 },
    /** "Go!" at the end of the countdown, sized to sit inside the ring. */
    go: { fontFamily: fontFamilies.black, fontSize: 200, lineHeight: 220 },
  },
  avatar: { grid: 168, row: 108, ready: 176, mini: 116 },
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
    title: { fontFamily: fontFamilies.extraBold, fontSize: 24, lineHeight: 30 },
    heading: { fontFamily: fontFamilies.black, fontSize: 32, lineHeight: 38 },
    hero: { fontFamily: fontFamilies.black, fontSize: 40, lineHeight: 46 },
    code: { fontFamily: fontFamilies.black, fontSize: 36, lineHeight: 42, letterSpacing: 6 },
    /** One letter of the room code in its entry box. */
    codeTile: { fontFamily: fontFamilies.black, fontSize: 44, lineHeight: 50 },
    /** "Go!" at the end of the countdown. */
    display: { fontFamily: fontFamilies.black, fontSize: 64, lineHeight: 72 },
    /** The countdown number itself. */
    countdown: { fontFamily: fontFamilies.black, fontSize: 120, lineHeight: 130 },
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
