import { describe, expect, it } from 'vitest';

import { shadowDepth, stickerShadowRect } from './shadows';

describe('stickerShadowRect', () => {
  it('displaces the shadow down and right by the given distance', () => {
    expect(stickerShadowRect(6)).toEqual(
      expect.objectContaining({ top: 6, left: 6 }),
    );
  });

  it('stays the same size as the surface it falls from', () => {
    // The negative far insets are the whole trick: a rect inset by `d` on two
    // sides and `-d` on the other two is the surface's own size, moved. Getting
    // these wrong shrinks the shadow instead of offsetting it, which reads as a
    // thin L rather than Boardwalk's solid slab.
    const distance = 6;
    const rect = stickerShadowRect(distance);

    expect(rect.right).toBe(-rect.left);
    expect(rect.bottom).toBe(-rect.top);
    // Width delta = -(left + right); zero means "same width as the surface".
    expect(rect.left + rect.right).toBe(0);
    expect(rect.top + rect.bottom).toBe(0);
  });

  it('hides the shadow at distance 0 rather than rejecting it', () => {
    // A button pressed all the way into its shadow lands here; it should read
    // as flat, not throw.
    expect(stickerShadowRect(0)).toEqual({ top: 0, left: 0, right: 0, bottom: 0 });
  });

  it('rejects a negative distance, which would throw the shadow up and left', () => {
    expect(() => stickerShadowRect(-2)).toThrow(RangeError);
  });

  it('rejects a non-finite distance rather than emitting NaN insets', () => {
    expect(() => stickerShadowRect(Number.NaN)).toThrow(RangeError);
    expect(() => stickerShadowRect(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('accepts every distance the handoff names', () => {
    for (const distance of Object.values(shadowDepth)) {
      expect(() => stickerShadowRect(distance)).not.toThrow();
    }
  });
});

describe('shadowDepth', () => {
  it('covers every distance the handoff gives a number for, smallest to largest', () => {
    expect(Object.values(shadowDepth)).toEqual([3, 4, 5, 6, 8, 10]);
  });
});
