// The Boardwalk design system (docs/design/design-handoff.md): the single
// source of every color, radius, border, shadow, and font face in Huddle.
export { type AccentFace, accentFace } from './accent-face';
export { type AvatarFace, avatarFace } from './avatar-face';
export { codeLetterBox } from './code-tile';
export { colors, type ColorToken } from './colors';
// `huddleFonts` is deliberately NOT re-exported here: it reaches four .ttf
// files, and a barrel is all-or-nothing, so one import of `colors` would drag
// the font binaries into any plain-Node consumer. It lives at
// `@huddle/ui/fonts` — see this package's `exports`.
export { tvDesignSize, tvStageScale, type WindowSize } from './layout';
export { motionDuration, popIn, type SpringConfig, springOf } from './motion';
export { elevation, type ElevationToken } from './shadows';
export { borderWidth, opacity, radius } from './shape';
export { fontFamily, letterSpacing, minBodyFontSize } from './typography';
