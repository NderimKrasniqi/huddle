// The Soft Minimal design system (docs/design/soft-minimal-handoff.md): the single
// source of every color, radius, border, shadow, and font face in Huddle.
export { type AccentFace, accentFace } from './accent-face';
export { type AvatarFace, avatarFace } from './avatar-face';
export { codeLetterBox } from './code-tile';
export { colors, type ColorToken } from './colors';
// The name only. The geometry, its viewBox and the shape types are what `Icon`
// draws from, and it reaches them directly — a screen names an icon and never
// composes one, which is the same split `KEY_ART_COLOR_NAMES` keeps.
export { type IconName } from './icons';
// `huddleFonts` is deliberately NOT re-exported here: it reaches four .ttf
// files, and a barrel is all-or-nothing, so one import of `colors` would drag
// the font binaries into any plain-Node consumer. It lives at
// `@huddle/ui/fonts` — see this package's `exports`.
export {
  tvDesignSize,
  tvSafeStageScale,
  tvStageScale,
  tvTitleSafeFraction,
  type WindowSize,
} from './layout';
export {
  loadingMotion,
  motionDuration,
  popIn,
  type SpringConfig,
  springOf,
} from './motion';
export { elevation, type ElevationToken } from './shadows';
export { borderWidth, opacity, radius } from './shape';
export { semanticStyles } from '@huddle/design-tokens';
export { fontFamily, letterSpacing, minBodyFontSize } from './typography';
