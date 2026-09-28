/**
 * The neutral pieces a game module may borrow: text, buttons, a screen shell,
 * simple icons and the player's avatar portrait. Everything else a game draws
 * — its colours, art and layout — belongs to the game. Nothing here depends on
 * Reanimated, so game logic and contract tests can load it in Node.
 */
export { AvatarPortrait, type AvatarPortraitProps } from './avatar-portrait';
export { HuddleButton, type HuddleButtonProps, type HuddleButtonVariant } from './huddle-button';
export { HuddleIcon, type HuddleIconName } from './huddle-icon';
export { HuddleText, type HuddleTextProps } from './huddle-text';
export { ScreenShell, type ScreenShellProps } from './screen-shell';
