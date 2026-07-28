import { colors } from './colors';
import { playerColor } from './player-colors';

/**
 * A Boardwalk accent with something written on it.
 *
 * The system uses its four accents as a cycle wherever a row of siblings has to
 * be told apart at a glance — the Room Code's letters run "cobalt, tangerine,
 * pink, green in order" (docs/design/design-handoff.md §1), and a set of answer
 * buttons is the same idea with the color moved from the text to the fill. What
 * a face adds over a color is the ink to write on it: white reads on cobalt and
 * disappears on yellow, so the pairing cannot be left to whoever draws it.
 */
export type AccentFace = {
  /** The block of color. */
  readonly fill: string;
  /** The color text on that fill is set in. */
  readonly label: string;
};

/** Boardwalk's accents in the order the system runs them. */
type AccentName = 'cobalt' | 'tangerine' | 'punch' | 'green';

/**
 * The accent in position `index`, cycling — a function of the position rather
 * than a table to index into, so every position is answered and no caller has
 * an out-of-range hole to handle (as in `codeTileTilt`).
 */
function accentAt(index: number): AccentName {
  switch (Math.abs(index) % 4) {
    case 0:
      return 'cobalt';
    case 1:
      return 'tangerine';
    case 2:
      return 'punch';
    default:
      return 'green';
  }
}

/**
 * The face in position `index`: the accent, and the ink to write on it.
 *
 * The ink is the one `player-colors.ts` already pairs with that accent, because
 * "what reads on cobalt" is one question with one answer — and that file is
 * where the answer is held to a contrast floor.
 */
export function accentFace(index: number): AccentFace {
  const accent = accentAt(index);
  return { fill: colors[accent], label: playerColor(accent).monogram };
}
