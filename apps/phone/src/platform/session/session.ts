import {
  normalizeRoomCode,
  ROOM_CODE_ACCEPTED_ALPHABET,
  ROOM_CODE_LENGTH,
} from '@huddle/domain';
import type { PlayerSession } from '../room-client';

export type { PlayerSession };

type JoinScreenState =
  | { readonly kind: 'restoring' }
  | { readonly kind: 'joining' }
  | { readonly kind: 'handoff'; readonly session: PlayerSession }
  | { readonly kind: 'seated'; readonly session: PlayerSession };

export function joinScreenState(
  session: PlayerSession | null | undefined,
  linkedCode: string,
): JoinScreenState {
  if (session === undefined) {
    return { kind: 'restoring' };
  }

  if (session === null) {
    return { kind: 'joining' };
  }

  const scanned = [...normalizeRoomCode(linkedCode)]
    .filter((letter) => ROOM_CODE_ACCEPTED_ALPHABET.includes(letter))
    .slice(0, ROOM_CODE_LENGTH)
    .join('');

  return scanned !== '' && scanned !== session.code
    ? { kind: 'handoff', session }
    : { kind: 'seated', session };
}
