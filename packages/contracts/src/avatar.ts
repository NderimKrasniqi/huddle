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

export type AvatarId = (typeof AVATAR_IDS)[number];

export function isAvatarId(value: string): value is AvatarId {
  return (AVATAR_IDS as readonly string[]).includes(value);
}
