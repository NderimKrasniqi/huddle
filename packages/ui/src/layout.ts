/**
 * Boardwalk lays TV screens out at a fixed design size and scales the whole
 * screen to whatever the television reports (docs/design/design-handoff.md:
 * "TV screens are designed at 1280×720 (scale ×1.5 for 1080p)").
 *
 * Every TV measurement in the handoff — a 148×176 code tile, an 88px Bungee
 * letter, a 6px offset shadow — is therefore written in code exactly as the
 * handoff gives it, and one transform at the root makes it fit. Reflowing each
 * screen against the live window instead would mean re-deriving those numbers
 * per resolution, which is how a pixel-perfect design stops being pixel-perfect.
 */
export const tvDesignSize = {
  width: 1280,
  height: 720,
} as const;

/** A window's dimensions, shaped like React Native's `useWindowDimensions()`. */
export type WindowSize = {
  readonly width: number;
  readonly height: number;
};

/**
 * How far to scale a `tvDesignSize` screen so it fits `window` whole.
 *
 * The smaller of the two ratios wins, so a window that is not 16:9 letterboxes
 * rather than crops or distorts — nothing on a TV screen is ever worth cutting
 * off, least of all a room code someone is trying to read.
 */
export function tvStageScale(window: WindowSize): number {
  return Math.min(window.width / tvDesignSize.width, window.height / tvDesignSize.height);
}
