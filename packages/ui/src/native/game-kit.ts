/**
 * The neutral pieces a game module may borrow: plain text, the motion and
 * countdown hooks, and the player's avatar portrait. Everything else a game draws
 * — its colours, art and layout — belongs to the game. Nothing here depends on
 * Reanimated, so game logic and contract tests can load it in Node.
 */
export { AvatarPortrait, type AvatarPortraitProps } from './avatar-portrait';
export { fontScaleCap } from './font-scale';
export { GameText, type GameTextProps } from './game-text';
export { useCountdownSeconds, useSystemReducedMotion } from './motion-preference';
