import { describe, expect, it } from 'vitest';

import { codeLetterBox, codeLetterColor, codeTileTilt } from './code-tile';
import { colors } from './colors';

// These check what the token *declares*, which is all a constant can be checked
// for: that the letter's box comes from its tile rather than its glyph is a
// fact about native text layout, and the A/B in Phase 5's task is what
// establishes it. What these guard is the declaration quietly changing.
describe('codeLetterBox', () => {
  it('declares the stretch that overrides a tile\'s own alignItems', () => {
    expect(codeLetterBox.alignSelf).toBe('stretch');
  });

  it('declares the centring that a stretched box then needs', () => {
    expect(codeLetterBox.textAlign).toBe('center');
  });
});

describe('codeLetterColor', () => {
  it('runs cobalt, tangerine, punch, green in order', () => {
    expect([0, 1, 2, 3].map(codeLetterColor)).toEqual([
      colors.cobalt,
      colors.tangerine,
      colors.punch,
      colors.green,
    ]);
  });

  it('cycles rather than running out of colors', () => {
    expect(codeLetterColor(4)).toBe(colors.cobalt);
    expect(codeLetterColor(7)).toBe(colors.green);
  });
});

describe('codeTileTilt', () => {
  it('alternates direction between siblings, within ±1–2°', () => {
    expect([0, 1, 2, 3].map(codeTileTilt)).toEqual(['-2deg', '1deg', '-1deg', '2deg']);
  });

  it('never tilts a tile out of the handoff\'s ±1–2° range', () => {
    for (let index = 0; index < 12; index += 1) {
      const degrees = Number.parseFloat(codeTileTilt(index));
      expect(Math.abs(degrees)).toBeGreaterThanOrEqual(1);
      expect(Math.abs(degrees)).toBeLessThanOrEqual(2);
    }
  });
});
