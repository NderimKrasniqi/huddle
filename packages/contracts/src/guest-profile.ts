import type { AvatarId } from './avatar';

export type GuestProfileV1 = {
  readonly version: 1;
  readonly guestId: string;
  readonly displayName: string;
  readonly avatarId: AvatarId;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function isGuestId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}
