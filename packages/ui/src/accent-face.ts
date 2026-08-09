import { colors } from './colors';

/**
 * A block of color with something written on it.
 *
 * One thing still needs a cycle of distinguishable colors: a game's answer
 * options, which have to be told apart at a glance and, crucially, have to be
 * told apart *the same way* on the phone and on the television. What a face
 * adds over a color is the ink to write on it — white reads on orange and
 * disappears on sage, so the pairing cannot be left to whoever draws it.
 *
 * ## This is interim
 *
 * Soft Minimal ran four accents and used them for two unrelated jobs: answer
 * options, and the Room Code's letters ("cobalt, tangerine, pink, green in
 * order"). Soft Minimal ends the second — every code letter is deep navy — and
 * has no opinion on the first, because the approved package designs no game
 * screen at all (`soft-minimal-handoff.md` lists both game frames as needing
 * design).
 *
 * So the cycle below is not a design decision dressed up as one. It is four
 * values already in the approved palette, kept distinguishable, so the games
 * stay coherent until their screens are actually designed. When they are, this
 * module is very likely to go the way the Room Code's cycle just did.
 */
export type AccentFace = {
  /** The block of color. */
  readonly fill: string;
  /** The color text on that fill is set in. */
  readonly label: string;
};

/**
 * The four faces, in the order the cycle runs them.
 *
 * Two take navy rather than white. Sage is the obvious one — a midtone, where
 * white measures about 2:1 and navy about 8:1. Orange is the one worth naming:
 * white on `#FF6B4A` is **2.82:1**, under even WCAG's 3:1 allowance for large
 * text, where navy on it is 6.34:1.
 *
 * The handoff does ask for white on orange (§8), and that stands where it is
 * about: the primary CTA, one high-intent button a player is looking for. These
 * are answer options — four of them, read at speed, at distance, on a
 * television — and a label a room has to squint at is a worse outcome than a
 * face that departs from the CTA's treatment. The CTA's own contrast is a real
 * finding and is recorded in the handoff rather than quietly fixed here.
 */
const FACES = [
  { fill: colors.accent, label: colors.ink },
  { fill: colors.ink, label: colors.inverse },
  { fill: colors.sage, label: colors.ink },
  { fill: colors.justJoined, label: colors.inverse },
] as const satisfies readonly AccentFace[];

/**
 * The face in position `index`, cycling — a function of the position rather
 * than a table to index into, so every position is answered and no caller has
 * an out-of-range hole to handle (as in `codeTileTilt`).
 */
export function accentFace(index: number): AccentFace {
  switch (Math.abs(index) % FACES.length) {
    case 0:
      return FACES[0];
    case 1:
      return FACES[1];
    case 2:
      return FACES[2];
    default:
      return FACES[3];
  }
}
