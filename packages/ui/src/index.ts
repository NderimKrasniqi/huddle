// The Boardwalk design system (docs/design/design-handoff.md): the single
// source of every color, radius, border, shadow, and font face in Huddle.
export { type AccentFace, accentFace } from './accent-face';
export { playerInitials } from './avatar';
export { codeLetterBox, codeLetterColor, codeTileTilt } from './code-tile';
export { colors, type ColorToken } from './colors';
// `boardwalkFonts` is deliberately NOT re-exported here: it reaches four .ttf
// files, and a barrel is all-or-nothing, so one import of `colors` would drag
// the font binaries into any plain-Node consumer. It lives at
// `@huddle/ui/fonts` — see this package's `exports`.
export { tvDesignSize, tvStageScale, type WindowSize } from './layout';
export { motionDuration, popIn, type SpringConfig, springOf } from './motion';
export { type PlayerColor, playerColor, playerFace, playerPalette } from './player-colors';
export { shadowDepth, stickerShadowRect, type ShadowRect } from './shadows';
export { borderWidth, opacity, radius, stickerTilt } from './shape';
export { fontFamily, letterSpacing, minBodyFontSize } from './typography';
