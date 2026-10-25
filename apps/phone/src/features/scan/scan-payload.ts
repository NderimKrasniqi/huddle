import { type LanJoin, normalizeRoomCode, parseRoomJoinLink, ROOM_CODE_ACCEPTED_ALPHABET, ROOM_CODE_LENGTH, roomJoinLink } from '@huddle/domain';

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


/** The in-app join route for a scanned code, keeping a hosting TV's address. */
export function roomJoinPath(code: string, lan: LanJoin | undefined): `/join/${string}` {
  return roomJoinLink(code, lan).replace(/^[a-z]+:\/\//u, '/') as `/join/${string}`;
}

/** The hosting TV's address from the join route's parameters, if they carry one. */
export function lanFromJoinParams(
  code: string,
  params: {
    readonly hosts?: string | string[];
    readonly port?: string | string[];
    readonly tv?: string | string[];
    readonly relay?: string | string[];
  },
): LanJoin | undefined {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';
  const query = `hosts=${encodeURIComponent(first(params.hosts)).replace(/%2C/giu, ',')}&port=${first(params.port)}&tv=${encodeURIComponent(first(params.tv))}&relay=${encodeURIComponent(first(params.relay))}`;
  return parseRoomJoinLink(`huddle://join/${code}?${query}`)?.lan;
}
