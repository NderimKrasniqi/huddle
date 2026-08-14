/**
 * The avatars a player can claim, as ids.
 *
 * Ids and not artwork, because the two sides need different halves of the same
 * fact: a phone claims a value and the server rules on whether anybody else in
 * the room holds it. The current neutral renderer does not need to know what a
 * fox looks like, so this remains protocol alongside Join Links and rejections.
 *
 * An id may never be renamed once a room has used one because it is stored on
 * the player row and persisted in guest profiles.
 *
 * The field remains required by the join contract even while the clean-slate
 * presentation is intentionally non-interactive.
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
