import { describe, expect, it } from 'vitest';

import { accentFace } from './accent-face';
import { codeLetterColor } from './code-tile';
import { colors } from './colors';
import { playerColor } from './player-colors';

/**
 * The accents as something to put text on. Two promises: the order is the
 * system's own, and the label ink is never picked twice.
 */
describe('a Boardwalk accent face', () => {
  it('runs the four accents in the order the system already uses them', () => {
    expect([0, 1, 2, 3].map((index) => accentFace(index).fill)).toEqual([
      colors.cobalt,
      colors.tangerine,
      colors.punch,
      colors.green,
    ]);
  });

  it('cycles, so every position has a face', () => {
    // Total like `codeLetterColor`: a caller with five of something gets a
    // fifth face rather than a hole to handle.
    expect(accentFace(4)).toEqual(accentFace(0));
    expect(accentFace(-1)).toEqual(accentFace(1));
  });

  it('sets its label in the ink Boardwalk already reads on that accent', () => {
    // Not a second opinion about what reads on cobalt: the pairing is decided
    // once in `player-colors.ts`, where a contrast floor is held to it, and
    // this is that decision rather than one taken again here.
    expect(accentFace(0).label).toBe(playerColor('cobalt').monogram);
    expect(accentFace(1).label).toBe(playerColor('tangerine').monogram);
    expect(accentFace(2).label).toBe(playerColor('punch').monogram);
    expect(accentFace(3).label).toBe(playerColor('green').monogram);
  });

  it('is what a Room Code’s letters are colored by', () => {
    // One accent cycle in the system, not two that happen to agree today.
    for (const position of [0, 1, 2, 3, 4, 5, 6, 7]) {
      expect(codeLetterColor(position)).toBe(accentFace(position).fill);
    }
  });
});
