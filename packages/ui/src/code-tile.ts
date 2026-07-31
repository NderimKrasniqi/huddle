import { accentFace } from './accent-face';

/**
 * A Room Code is rendered one letter per tile — on the TV's pairing screen and,
 * later, in the Controller's code entry. Boardwalk gives the tiles a fixed
 * per-position treatment (docs/design/design-handoff.md): the letters run
 * cobalt, tangerine, punch, green "in order", and the tiles are tilted ±1–2°,
 * "alternating direction between siblings".
 *
 * Both are functions of the tile's position rather than tables to index into,
 * so a position is total — every caller gets an answer, no caller handles an
 * out-of-range hole that a 4-letter code cannot produce anyway.
 */

/**
 * The color the letter in position `index` is drawn in — the accent cycle, of
 * which this is the oldest use rather than a second copy (`accent-face.ts`).
 */
export function codeLetterColor(index: number): string {
  return accentFace(index).fill;
}

/** The sticker tilt of the tile in position `index`, ready for `rotate`. */
export function codeTileTilt(index: number): `${number}deg` {
  const position = Math.abs(index) % 4;
  const direction = position % 2 === 0 ? -1 : 1;
  // Outer tiles lean harder than inner ones, which fans the row slightly.
  const degrees = position === 0 || position === 3 ? 2 : 1;
  return `${direction * degrees}deg`;
}
