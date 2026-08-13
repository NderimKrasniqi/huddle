/**
 * The avatars a player can claim, as ids.
 *
 * Ids and not artwork, because the two sides need different halves of the same
 * fact: a phone claims the tile it tapped and the server rules on whether
 * anybody else in the room holds it, neither of which needs to know what a fox
 * looks like. What it looks like is `packages/ui`'s business. So this is
 * protocol, like the Join Link and the Join Rejection, and it lives where
 * protocol lives.
 *
 * Each id is the filename stem of its artwork in `packages/ui/assets/avatars/`,
 * which is what lets the asset map there be keyed by this list rather than by a
 * second list that has to be kept in step. It is also why an id may never be
 * renamed once a room has used one: it is stored on the player row.
 *
 * This replaces the ten claimable colors. A player used to join and *then* pick
 * a swatch, so a seat had to be drawable before the choice was made; the avatar
 * is chosen on the join form, so there is no unclaimed state to draw and the
 * field is required rather than optional.
 */
export const AVATAR_IDS = [
  'fox',
  'green-alien',
  'pink-bunny',
  'blue-robot',
  'purple-owl',
  'yellow-robot',
  'red-robot',
  'teal-bear',
  'mint-cat',
  'puppy',
] as const;

/** One of the claimable avatars. */
export type AvatarId = (typeof AVATAR_IDS)[number];

/**
 * Whether a string names a claimable avatar.
 *
 * The server asks because it cannot assume anybody asked before it: `joinRoom`
 * is public and Huddle has no auth by design, so the picker's own grid is what
 * the player sees, not a promise about what arrives.
 */
export function isAvatarId(value: string): value is AvatarId {
  return (AVATAR_IDS as readonly string[]).includes(value);
}
