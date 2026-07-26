/**
 * The Room Code format: 4 letters, A–Z (docs/implementation-plan.md pins it).
 * It lives here rather than in the backend because every side of the protocol
 * needs it — Convex mints codes, the TV renders one tile per letter, and the
 * Controller's join screen advances one cell per typed letter.
 *
 * The alphabet is the full A–Z: Huddle's codes carry no digits, so the
 * confusable pairs that usually justify a reduced alphabet (O/0, I/1, S/5,
 * B/8) cannot arise, and dropping letters would cost a third of the 456,976
 * codes for nothing.
 */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Letters per Room Code. */
export const ROOM_CODE_LENGTH = 4;

/**
 * A source of randomness shaped like `Math.random`: uniform over [0, 1).
 * Injectable so that code generation is exactly reproducible under test.
 */
export type RandomSource = () => number;

/**
 * One random Room Code. Says nothing about whether the code is free — codes
 * are only unique because the room that mints one checks it against the rooms
 * that already exist (see `createRoom`).
 */
export function generateRoomCode(random: RandomSource = Math.random): string {
  let code = '';
  for (let position = 0; position < ROOM_CODE_LENGTH; position += 1) {
    const letterIndex = Math.floor(random() * ROOM_CODE_ALPHABET.length);
    code += ROOM_CODE_ALPHABET.charAt(letterIndex);
  }
  return code;
}
