import { describe, expect, it } from 'vitest';

import { LOADING_HEART_COLORS, loadingHeartAngles } from './loading-mark';

describe('Heartbeat loading orbit', () => {
  it('spaces the four approved heart colors evenly around a full orbit', () => {
    expect(LOADING_HEART_COLORS).toHaveLength(4);
    expect(LOADING_HEART_COLORS).toEqual([
      '#FF6F61',
      '#FFD766',
      '#7CC6FF',
      '#7FD2B6',
    ]);
    expect(LOADING_HEART_COLORS.map((_, index) => loadingHeartAngles(index))).toEqual([
      ['0deg', '360deg'],
      ['90deg', '450deg'],
      ['180deg', '540deg'],
      ['270deg', '630deg'],
    ]);
  });
});
