/**
 * The colors a Game Module may set its Key Art in, as names.
 *
 * Key Art was the handoff's game card: a flat color block with the title on it,
 * which was the whole treatment because a module shipped no images.
 *
 * Soft Minimal ships artwork instead — `packages/ui/assets/game-art/` is
 * full-bleed per §10, and the approved carousel draws three illustrated cards
 * rather than three colored rectangles. So this mechanism is on its way out,
 * and what remains of it is the fallback a module with no art gets.
 *
 * Names for the same reason `PLAYER_COLOR_NAMES` are names: a module declares
 * which one it wears, and `packages/ui` is the only place in Huddle a color may
 * be written down. Every name here is one of its `ColorToken`s —
 * `packages/ui/src/key-art.test.ts` holds the two lists to each other, from the
 * side that owns the values.
 */
export const KEY_ART_COLOR_NAMES = ['accent', 'ink', 'sage', 'justJoined', 'online'] as const;

/** One of the colors a Game Module's Key Art can be set in. */
export type KeyArtColorName = (typeof KEY_ART_COLOR_NAMES)[number];
