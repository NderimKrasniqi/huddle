import { describe, expect, it } from 'vitest';

import { isPlayerColorName, PLAYER_COLOR_NAMES } from './player-color';

describe('the claimable colors', () => {
  it('number ten', () => {
    // Ten, spelled out rather than read off the list: it is the plan's pinned
    // number and it is load-bearing — a room seats ten players, so a palette of
    // nine would leave the last one to join with nothing to claim.
    expect(PLAYER_COLOR_NAMES).toHaveLength(10);
  });

  it('are ten different names', () => {
    // A repeat would take a color away from somebody while still looking like a
    // full palette, and the picker would draw one swatch twice.
    expect(new Set(PLAYER_COLOR_NAMES).size).toBe(PLAYER_COLOR_NAMES.length);
  });
});

describe('isPlayerColorName', () => {
  it('recognises every color a picker can send', () => {
    for (const color of PLAYER_COLOR_NAMES) {
      expect(isPlayerColorName(color)).toBe(true);
    }
  });

  it('turns away anything else', () => {
    // The server's guard against a caller that is not the picker — there is no
    // auth in front of `claimColor`, by design.
    expect(isPlayerColorName('chartreuse')).toBe(false);
    expect(isPlayerColorName('')).toBe(false);
    expect(isPlayerColorName('COBALT')).toBe(false);
    // Not a color, and not a way to reach anything on the prototype chain.
    expect(isPlayerColorName('toString')).toBe(false);
  });
});
