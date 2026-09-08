/**
 * Backward-compatible key-art color names in the GameModule contract.
 *
 * The contract keeps these legacy semantic names so registered modules and
 * persisted server data retain their existing shape. Heartbeat renderers map
 * module metadata through the current card and artwork primitives.
 */
export const KEY_ART_COLOR_NAMES = ['accent', 'ink', 'sage', 'justJoined', 'online'] as const;

/** One of the colors a Game Module's Key Art can be set in. */
export type KeyArtColorName = (typeof KEY_ART_COLOR_NAMES)[number];
