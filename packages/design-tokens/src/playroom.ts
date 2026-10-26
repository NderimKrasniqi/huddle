const fontFamilies = {
  regular: 'Nunito_400Regular',
  bold: 'Nunito_700Bold',
  extraBold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
} as const;

export const playroomColors = {
  canvas: '#F9F1E6',
  surface: '#FFFCF7',
  ink: '#2D0B4E',
  muted: '#6D5B79',
  orange: '#FF781F',
  lavender: '#E3D9FF',
  border: '#D8CCDF',
  success: '#286447',
  successSurface: '#D4F1CC',
  danger: '#A52C44',
  dangerSurface: '#FFE0E5',
  disabled: '#E5DEE9',
} as const;

export const playroomScrim = 'rgba(45, 11, 78, 0.35)';

export const playroomButtonEdge = 'rgba(45, 11, 78, 0.18)';

export const playroomCoverColors: Readonly<Record<string, string>> = {
  trivia: '#DED2FF', 'bomb-squad': '#CFEBDC', 'sumo-bumpers': '#CFE6FF',
};

export type PlayroomColor = keyof typeof playroomColors;

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

export const playroomFonts = {
  body: fontFamilies.regular,
  label: fontFamilies.bold,
  strong: fontFamilies.extraBold,
  heading: fontFamilies.black,
} as const;

export const playroomSpacing = [4, 8, 12, 16, 24, 32, 48, 64, 96] as const;

export const playroomRadii = {
  input: 16,
  button: 20,
  card: 28,
  pill: 999,
} as const;

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
    title: { fontFamily: fontFamilies.extraBold, fontSize: 56, lineHeight: 64 },
    heading: { fontFamily: fontFamilies.black, fontSize: 84, lineHeight: 92 },
    hero: { fontFamily: fontFamilies.black, fontSize: 104, lineHeight: 112 },
    roomCode: { fontFamily: fontFamilies.black, fontSize: 96, lineHeight: 104 },
    countdown: { fontFamily: fontFamilies.black, fontSize: 384, lineHeight: 400 },
    feature: { fontFamily: fontFamilies.black, fontSize: 76, lineHeight: 84 },
    codeTile: { fontFamily: fontFamilies.black, fontSize: 132, lineHeight: 140 },
    go: { fontFamily: fontFamilies.black, fontSize: 200, lineHeight: 220 },
  },
  avatar: { grid: 168, row: 108, ready: 176, mini: 116 },
} as const;

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
    codeTile: { fontFamily: fontFamilies.black, fontSize: 44, lineHeight: 50 },
    display: { fontFamily: fontFamilies.black, fontSize: 64, lineHeight: 72 },
    countdown: { fontFamily: fontFamilies.black, fontSize: 120, lineHeight: 130 },
  },
  avatar: { tile: 48, feature: 140, identity: 58 },
} as const;

export const playroomShadows = {
  card: {
    shadowColor: playroomColors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;

export const playroomMotion = {
  press: 100,
  pressScale: 0.98,
  transition: 180,
  entrance: 240,
  entranceTravel: 12,
  stagger: 40,
  highlight: 600,
  tick: 1000,
} as const;

export const playroomEasing = {
  out: [0.23, 1, 0.32, 1],
  inOut: [0.77, 0, 0.175, 1],
} as const;
