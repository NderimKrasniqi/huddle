import { fontFamilies } from './typography';

/**
 * Playroom, the approved Huddle platform direction
 * (docs/design/playroom/README.md): cream surfaces, deep-purple ink, one orange
 * action per screen, lavender for everything secondary.
 *
 * Game modules do not consume these; each game owns its own theme.
 */
export const playroomColors = {
  cream: '#FCF6EF',
  card: '#FFFFFF',
  ink: '#1F0B3F',
  inkSoft: '#3B2B5E',
  muted: '#7A6E90',
  line: '#EFE6DF',
  orange: '#FC6221',
  orangeDeep: '#D94A10',
  lavender: '#F0E8F8',
  lavenderStrong: '#E1D2F4',
  purple: '#6838DF',
  green: '#0E9F3E',
  red: '#D63B3B',
  soonGrey: '#EFECF0',
  soonText: '#6F6680',
  yellow: '#FFC532',
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

/** Nunito weights: Black for headings and codes, ExtraBold for actions and names. */
export const playroomFonts = {
  black: fontFamilies.black,
  extraBold: fontFamilies.extraBold,
  bold: fontFamilies.bold,
  regular: fontFamilies.regular,
} as const;

/**
 * The TV stage is drawn at 1920×1080 and scaled to the screen, inside a 5%
 * overscan-safe frame. Sizes are stage pixels.
 */
export const playroomTv = {
  width: 1920,
  height: 1080,
  safeX: 96,
  safeY: 54,
  wordmarkHeight: 84,
  type: {
    heading: { fontFamily: fontFamilies.black, fontSize: 108, lineHeight: 116 },
    code: { fontFamily: fontFamilies.black, fontSize: 142, lineHeight: 150 },
    subheading: { fontFamily: fontFamilies.extraBold, fontSize: 40, lineHeight: 48 },
    chip: { fontFamily: fontFamilies.extraBold, fontSize: 30, lineHeight: 38 },
    status: { fontFamily: fontFamilies.extraBold, fontSize: 36, lineHeight: 44 },
    name: { fontFamily: fontFamilies.black, fontSize: 32, lineHeight: 38 },
    body: { fontFamily: fontFamilies.bold, fontSize: 26, lineHeight: 34 },
    countdown: { fontFamily: fontFamilies.black, fontSize: 250, lineHeight: 260 },
  },
  avatar: { grid: 146, row: 119, ready: 157, mini: 84 },
  radius: { card: 44, tile: 30, pill: 999 },
} as const;

/** Phone sizes in points for a 390-point-wide screen; layouts stay fluid. */
export const playroomPhone = {
  gutter: 22,
  type: {
    heading: { fontFamily: fontFamilies.black, fontSize: 30, lineHeight: 34 },
    code: { fontFamily: fontFamilies.black, fontSize: 40, lineHeight: 44 },
    title: { fontFamily: fontFamilies.black, fontSize: 27, lineHeight: 31 },
    button: { fontFamily: fontFamilies.extraBold, fontSize: 17, lineHeight: 22 },
    name: { fontFamily: fontFamilies.black, fontSize: 15, lineHeight: 19 },
    body: { fontFamily: fontFamilies.bold, fontSize: 15, lineHeight: 21 },
    small: { fontFamily: fontFamilies.bold, fontSize: 12, lineHeight: 16 },
  },
  buttonHeight: 52,
  avatar: { tile: 48, feature: 140, identity: 58 },
  radius: { card: 20, row: 14, pill: 999 },
} as const;

/** Soft shadows tinted with the ink colour. */
export const playroomShadows = {
  card: {
    shadowColor: playroomColors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  action: {
    shadowColor: playroomColors.orange,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
} as const;

/**
 * Playroom motion, in milliseconds. UI motion stays under 300 ms; only rare
 * moments (a player arriving, the countdown's Go) get more. Reduced motion
 * keeps the opacity changes and drops movement and scale.
 */
export const playroomMotion = {
  /** Press-in scale feedback. */
  press: 120,
  /** A chip or segment changing colour. */
  toggle: 150,
  /** A badge, the countdown number, or a toast arriving. */
  pop: 200,
  /** A TV surface replacing another. */
  enter: 250,
  /** The TV carousel following the host. */
  glide: 300,
  /** A changed setting's highlight fading out. */
  highlight: 600,
  /** Delay between seats when a grid first appears. */
  stagger: 40,
  /** One countdown step. */
  tick: 1000,
  /** One slow drift of a decorative prop. */
  drift: 11000,
  /** How long props bob after a screen appears before they settle. */
  settle: 10000,
} as const;

/** Cubic-bezier control points; `Easing.bezier(...playroomEasing.out)`. */
export const playroomEasing = {
  /** Entering and exiting: starts fast, so it feels responsive. */
  out: [0.23, 1, 0.32, 1],
  /** Moving on screen. */
  inOut: [0.77, 0, 0.175, 1],
} as const;

/** Spring configs in Apple's duration / damping-ratio form. */
export const playroomSprings = {
  /** Settles with no overshoot. */
  settle: { duration: 400, dampingRatio: 1 },
  /** A player arriving: a little life, still restrained. */
  arrive: { duration: 400, dampingRatio: 0.8 },
} as const;
