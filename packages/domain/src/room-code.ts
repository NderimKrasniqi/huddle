/**
 * The letters a Room Code is minted from: the full A–Z
 * (docs/implementation-plan.md pins the 4-letter shape). It lives here rather
 * than in the backend because every side of the protocol needs it — Convex
 * mints codes, the TV renders one tile per letter, and the Phone's join
 * screen advances one cell per typed letter.
 *
 * **The full alphabet is deliberate.** A tvOS text-layout cache once made an I
 * that arrived after an empty tile look blank. The Code Letter Box now gives every
 * letter the tile's box instead of trusting the glyph's measured width, and an
 * A/B on the TV showed the failing code draw reliably after that fix. The
 * temporary no-I mitigation therefore ended on 2026-08-02: I is safe to mint
 * again, and leaving it out would keep a workaround after its cause was fixed.
 *
 * Nothing is dropped. Huddle's codes carry no digits, so the confusable pairs
 * that usually justify a reduced alphabet (O/0, I/1, S/5, B/8) cannot arise,
 * and the full alphabet leaves 456,976 codes.
 *
 * It mints and it never judges: a code arriving from a phone is checked against
 * `ROOM_CODE_ACCEPTED_ALPHABET` or against nothing at all. The accepted
 * alphabet remains full A–Z so rooms minted before this decision are still
 * typeable from the television.
 */
export const ROOM_CODE_MINT_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * The letters a Room Code may be *read* as holding: the full A–Z, the I
 * included.
 *
 * The minting and accepted alphabets are both full A–Z now. Keeping this as a
 * separate named contract still matters: whatever a player can read off a TV
 * must be typeable, and `joinRoom` normalises a typed code without checking it
 * against an alphabet. That preserves access to codes minted under the former
 * no-I mitigation as well as to new codes.
 */
export const ROOM_CODE_ACCEPTED_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Letters per Room Code. */
export const ROOM_CODE_LENGTH = 4;

/**
 * Canonical room-code normalization shared by every protocol boundary.
 * Whitespace is input decoration, while case is not part of a room's identity.
 * Alphabet and length validation remain the responsibility of the caller that
 * owns its input surface.
 */
export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * A source of randomness shaped like `Math.random`: uniform over [0, 1).
 * Injectable so that code generation is exactly reproducible under test.
 */
export type RandomSource = () => number;

/**
 * One random Room Code. Says nothing about whether the code is free — codes
 * are only unique because the room that mints one checks it against the rooms
 * that already exist (see `rooms.openRoom`).
 */
export function generateRoomCode(random: RandomSource = Math.random): string {
  let code = '';
  for (let position = 0; position < ROOM_CODE_LENGTH; position += 1) {
    const letterIndex = Math.floor(random() * ROOM_CODE_MINT_ALPHABET.length);
    code += ROOM_CODE_MINT_ALPHABET.charAt(letterIndex);
  }
  return code;
}
