/**
 * A Room Code is rendered one letter per tile — on the TV's pairing screen and
 * in the Controller's code entry.
 *
 * Soft Minimal coloured the letters by position, running its four accents "in
 * order". Soft Minimal draws every letter in deep navy: the approved board
 * shows four identical white tiles with one navy character each, on both the
 * phone and the television. `codeLetterColor` went with the cycle — a caller
 * that wants the colour of a code letter wants `colors.ink`, and a function
 * that returns the same value for every input is a function pretending a
 * decision is still being made.
 *
 * Soft Minimal also tilted the tiles ±1–2°, "alternating direction between
 * siblings". Soft Minimal's are upright — the approved board draws four square
 * tiles in a straight row — so `codeTileTilt` went with the lean.
 */

/**
 * How a Room Code letter sits in its tile: the box is the tile's, never the
 * glyph's. Spread it into the letter's text style.
 *
 * Soft Minimal's tiles are fixed-size cells with one centred letter, so a letter
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
