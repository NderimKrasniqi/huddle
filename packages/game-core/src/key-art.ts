/**
 * The colors a Game Module may set its Key Art in, as names.
 *
 * Key Art is the handoff's game card: "flat color block + Bungee title"
 * (docs/design/design-handoff.md §6). The block is the whole treatment, so
 * choosing it is the whole of a module's say over how the carousel draws it —
 * a module ships no images, and cannot ship a color either.
 *
 * Names for the same reason `PLAYER_COLOR_NAMES` are names: a module declares
 * which one it wears, and `packages/ui` is the only place in Huddle a color may
 * be written down. These five are Boardwalk's accents, so every name here is
 * one of its `ColorToken`s — `packages/ui/src/key-art.test.ts` is what holds
 * the two lists to each other, from the side that owns the values.
 *
 * Five and not the player palette's ten: a game card is a poster, and the
 * remaining five exist to give ten players ten distinguishable avatars, which
 * is not a job a game card has.
 */
export const KEY_ART_COLOR_NAMES = ['cobalt', 'tangerine', 'punch', 'green', 'yellow'] as const;

/** One of the colors a Game Module's Key Art can be set in. */
export type KeyArtColorName = (typeof KEY_ART_COLOR_NAMES)[number];
