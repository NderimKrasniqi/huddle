import { normalizeRoomCode, ROOM_CODE_ACCEPTED_ALPHABET, ROOM_CODE_LENGTH } from '@huddle/domain';

export type ScanPayloadResult =
  | { readonly kind: 'join'; readonly code: string }
  | { readonly kind: 'malformed' };

/** Strictly accepts the canonical QR protocol emitted by the TV. */
export function decodeJoinQr(payload: string): ScanPayloadResult {
  const match = /^huddle:\/\/join\/([^/?#]+)$/u.exec(payload.trim());
  if (match === null) return { kind: 'malformed' };
  const code = normalizeRoomCode(match[1] ?? '');
  if (
    code.length !== ROOM_CODE_LENGTH ||
    [...code].some((letter) => !ROOM_CODE_ACCEPTED_ALPHABET.includes(letter))
  ) {
    return { kind: 'malformed' };
  }
  return { kind: 'join', code };
}

export function shouldHandleScan(locked: boolean): boolean {
  return !locked;
}
