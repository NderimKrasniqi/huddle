/**
 * Backward-compatible key-art color names in the GameModule contract.
 *
 * The clean-slate native renderer intentionally does not draw key art, but the
 * contract remains unchanged so registered modules and server data keep their
 * existing shape.
 */
export const KEY_ART_COLOR_NAMES = ['accent', 'ink', 'sage', 'justJoined', 'online'] as const;

/** One of the colors a Game Module's Key Art can be set in. */
export type KeyArtColorName = (typeof KEY_ART_COLOR_NAMES)[number];
