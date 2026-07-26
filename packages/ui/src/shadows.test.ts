import { describe, expect, it } from 'vitest';

import { colors } from './colors';
import { offsetShadow, shadowDepth } from './shadows';

describe('offsetShadow', () => {
  it('offsets down and right by the given distance', () => {
    expect(offsetShadow(6)).toEqual([
      expect.objectContaining({ offsetX: 6, offsetY: 6 }),
    ]);
  });

  it('is never blurred — the shadow edge is what makes it Boardwalk', () => {
    expect(offsetShadow(4)).toEqual([
      expect.objectContaining({ blurRadius: 0 }),
    ]);
  });

  it('defaults to ink', () => {
    expect(offsetShadow(4)).toEqual([
      expect.objectContaining({ color: colors.ink }),
    ]);
  });

  it('takes an accent color for highlight variants', () => {
    expect(offsetShadow(8, colors.punch)).toEqual([
      { offsetX: 8, offsetY: 8, blurRadius: 0, color: colors.punch },
    ]);
  });

  it('produces exactly one shadow layer', () => {
    expect(offsetShadow(shadowDepth.tvHero)).toHaveLength(1);
  });
});

describe('shadowDepth', () => {
  it('covers every distance the handoff gives a number for, smallest to largest', () => {
    expect(Object.values(shadowDepth)).toEqual([3, 4, 5, 6, 8, 10]);
  });
});
