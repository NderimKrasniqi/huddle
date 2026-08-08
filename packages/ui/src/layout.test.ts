import { describe, expect, it } from 'vitest';

import { tvDesignSize, tvSafeStageScale, tvStageScale, tvTitleSafeFraction } from './layout';

describe('tvStageScale', () => {
  it('leaves a screen at the design size alone', () => {
    expect(tvStageScale(tvDesignSize)).toBe(1);
  });

  it('scales the handoff\'s ×1.5 for 1080p', () => {
    expect(tvStageScale({ width: 1920, height: 1080 })).toBe(1.5);
  });

  it('shrinks for a TV that reports fewer points than the design size', () => {
    expect(tvStageScale({ width: 960, height: 540 })).toBe(0.75);
  });

  it('letterboxes rather than crops when the window is not 16:9', () => {
    // Wider than 16:9 — height is the binding constraint, and vice versa.
    expect(tvStageScale({ width: 2560, height: 720 })).toBe(1);
    expect(tvStageScale({ width: 1280, height: 1440 })).toBe(1);
  });
});

describe('tvSafeStageScale', () => {
  it('pulls the fitted surface into the title-safe inner 90%', () => {
    // The design surface itself fits at ×1, so the safe stage is the fraction.
    expect(tvSafeStageScale(tvDesignSize)).toBe(tvTitleSafeFraction);
    expect(tvSafeStageScale(tvDesignSize)).toBe(0.9);
  });

  it('keeps the 5% overscan gutter at every resolution', () => {
    // 1080p fits at ×1.5; the title-safe stage lands 10% short of the edge.
    expect(tvSafeStageScale({ width: 1920, height: 1080 })).toBe(1.35);
    expect(tvSafeStageScale({ width: 960, height: 540 })).toBe(0.675);
  });

  it('letterboxes on the binding axis before insetting', () => {
    expect(tvSafeStageScale({ width: 2560, height: 720 })).toBe(0.9);
    expect(tvSafeStageScale({ width: 1280, height: 1440 })).toBe(0.9);
  });
});
