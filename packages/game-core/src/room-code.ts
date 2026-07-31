/**
 * The letters a Room Code is minted from: A–Z without I
 * (docs/implementation-plan.md pins the 4-letter shape). It lives here rather
 * than in the backend because every side of the protocol needs it — Convex
 * mints codes, the TV renders one tile per letter, and the Controller's join
 * screen advances one cell per typed letter.
 *
 * **I is left out as a mitigation. The bug it dodges is open.** On tvOS a Room
 * Code letter that is not in the tile's first committed render does not paint,
 * and I is the only letter in the alphabet narrow enough for the miss to read
 * as an empty tile. The code always arrives from the server after the tiles
 * mount, so every code holding an I showed a hole — in a Release build too,
 * where room `RJBI` drew as `R J B _` — and a blank tile makes the room
 * unjoinable from the television. Remounting the text node, the tile and the
 * whole row were each tried and each still blanked, so the fault is below React
 * and the mechanism is still unknown: see "A Room Code tile sometimes draws
 * empty on tvOS" in docs/implementation-plan.md, which stays open. Minting no I
 * buys a code that is always readable; it does not make the tiles correct, and
 * the next letter to fall foul of the same fault would not be caught by this.
 *
 * Nothing else is dropped. Huddle's codes carry no digits, so the confusable
 * pairs that usually justify a reduced alphabet (O/0, I/1, S/5, B/8) cannot
 * arise, and the 25 letters still leave 390,625 codes.
 *
 * It mints and it never judges: a code arriving from a phone is checked against
 * `ROOM_CODE_ACCEPTED_ALPHABET` or against nothing at all. Filtering input by
 * this one would reject the live rooms whose codes were drawn before the I came
 * out — a room on a television that nobody can type.
 */
export const ROOM_CODE_MINT_ALPHABET = 'ABCDEFGHJKLMNOPQRSTUVWXYZ';

/**
 * The letters a Room Code may be *read* as holding: the full A–Z, the I
 * included.
 *
 * The two alphabets differ on purpose, and only in that direction. Rooms minted
 * before the I came out are still live, still showing their code on a
 * television, and still looked up by `joinRoom`, which normalises a typed code
 * without ever checking it against an alphabet. So whatever a player can read
 * off a TV they must be able to type: refusing the I on the join screen would
 * turn a rendering mitigation into a room nobody can reach, which is the
 * failure it exists to prevent.
 */
export const ROOM_CODE_ACCEPTED_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

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
    const letterIndex = Math.floor(random() * ROOM_CODE_MINT_ALPHABET.length);
    code += ROOM_CODE_MINT_ALPHABET.charAt(letterIndex);
  }
  return code;
}
