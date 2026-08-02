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

/**
 * How a Room Code letter sits in its tile: the box is the tile's, never the
 * glyph's. Spread it into the letter's text style.
 *
 * Boardwalk's tiles are fixed-size cells with one centred letter, so a letter
 * that sized itself to its own glyph was reaching the same pixels by a longer
 * route — and on tvOS that route is broken. React Native measures an empty
 * `<Text>` by substituting the placeholder string **"I"**
 * (`ensurePlaceholderIfEmpty_DO_NOT_USE`), zeroes the width of the result
 * because the string really was empty, and then caches that result under the
 * *placeholder's* key (`TextLayoutManager::measure`). That key is the attributed
 * string — its text and the attributes that affect layout — together with the
 * paragraph attributes and the layout constraints (`TextMeasureCacheKey`), so
 * any later text reading exactly "I" under those same three hits the entry, is
 * laid out 0pt wide, and paints nothing. That is the blank Room Code tile:
 * the tiles are drawn empty before the code arrives, which files a 0-width "I"
 * in the cache, and an I in the code that lands afterwards is then invisible.
 *
 * Taking the width from the tile leaves the letter's appearance independent of
 * that measurement, which is why this is the fix and not a narrower alphabet.
 */
export const codeLetterBox = {
  // Overrides the tile's own `alignItems: 'center'`, which would otherwise
  // shrink-wrap the letter to whatever the glyph measured.
  alignSelf: 'stretch',
  textAlign: 'center',
} as const;

/** The sticker tilt of the tile in position `index`, ready for `rotate`. */
export function codeTileTilt(index: number): `${number}deg` {
  const position = Math.abs(index) % 4;
  const direction = position % 2 === 0 ? -1 : 1;
  // Outer tiles lean harder than inner ones, which fans the row slightly.
  const degrees = position === 0 || position === 3 ? 2 : 1;
  return `${direction * degrees}deg`;
}
