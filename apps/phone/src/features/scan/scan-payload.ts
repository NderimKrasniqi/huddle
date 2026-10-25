import { type LanJoin, normalizeRoomCode, parseRoomJoinLink, ROOM_CODE_ACCEPTED_ALPHABET, ROOM_CODE_LENGTH } from '@huddle/domain';

export type ScanPayloadResult =
  | { readonly kind: 'join'; readonly code: string; readonly lan?: LanJoin }
  | { readonly kind: 'malformed' };

/** Strictly accepts the canonical QR protocol emitted by the TV. */
export function decodeJoinQr(payload: string): ScanPayloadResult {
  const link = parseRoomJoinLink(payload);
  if (link === undefined) return { kind: 'malformed' };
  const code = normalizeRoomCode(link.code);
  if (
    code.length !== ROOM_CODE_LENGTH ||
    [...code].some((letter) => !ROOM_CODE_ACCEPTED_ALPHABET.includes(letter))
  ) {
    return { kind: 'malformed' };
  }
  return link.lan === undefined ? { kind: 'join', code } : { kind: 'join', code, lan: link.lan };
}

