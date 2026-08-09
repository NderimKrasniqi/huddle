/**
 * Soft Minimal lays TV screens out at a fixed design size and scales the whole
 * screen to whatever the television reports (docs/design/soft-minimal-handoff.md:
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

/**
 * The share of the fitted surface it is safe to draw on — the inner 90%, a 5%
 * gutter all round.
 *
 * A television crops the outer ~5% of every edge and, unlike a monitor, does it
 * without saying so: `useWindowDimensions()` reports the whole 1920×1080 while
 * the bezel hides the border (this is overscan, a leftover from broadcast). The
 * classic "title-safe" area is that inner 90%, and drawing inside it is the only
 * guarantee a room code or a footer is not sitting under the plastic.
 *
 * This is the one thing the 1280×720 handoff does not carry: it is a flat canvas
 * with no overscan, so its numbers reach the very edge. Rather than re-inset
 * every screen — and re-argue every pinned measurement against a new frame — the
 * whole stage is scaled into the safe rectangle at `tvSafeStageScale`, the single
 * point it is already scaled to the television.
 */
export const tvTitleSafeFraction = 0.9;

/**
 * What `TvStage` actually scales by: the fit from `tvStageScale`, pulled in to
 * the title-safe rectangle so overscan crops the screen-colored margin instead
 * of the screen. Everything inside the stage keeps the handoff's own numbers;
 * the whole composition just sits `tvTitleSafeFraction` of the way out to the
 * edge, where the bezel cannot reach it.
 */
export function tvSafeStageScale(window: WindowSize): number {
  return tvStageScale(window) * tvTitleSafeFraction;
}
