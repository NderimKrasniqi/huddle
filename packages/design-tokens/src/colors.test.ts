import { describe, expect, it } from 'vitest';

import { brandColors, semanticColors } from './colors';

const relativeLuminance = (hex: string): number => {
  const channels = [0, 1, 2].map((offset) =>
    Number.parseInt(hex.slice(1 + offset * 2, 3 + offset * 2), 16) / 255,
  );
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );

  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
};

const contrastRatio = (foreground: string, background: string): number => {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
};

describe('Heartbeat colors', () => {
  it('contains the approved brand primitives', () => {
    expect(brandColors).toEqual({
      cream: '#F9F1E6',
      espresso: '#2B1F17',
      coral: '#FF6F61',
      butter: '#FFD766',
      mint: '#7FD2B6',
      sky: '#7CC6FF',
      lilac: '#C8B6FF',
      dustyRose: '#E6A3B1',
    });
  });

  it('exposes Heartbeat semantic roles', () => {
    expect(semanticColors.background).toBe(brandColors.cream);
    expect(semanticColors.text).toBe(brandColors.espresso);
    expect(semanticColors.primary).toBe(brandColors.coral);
    expect(semanticColors.primaryText).toBe(brandColors.espresso);
  });

  it('approves espresso on every light brand fill', () => {
    const fills = [
      brandColors.cream,
      brandColors.coral,
      brandColors.butter,
      brandColors.mint,
      brandColors.sky,
      brandColors.lilac,
      brandColors.dustyRose,
    ];

    for (const fill of fills) {
      expect(contrastRatio(brandColors.espresso, fill), `espresso on ${fill}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('does not approve white text on coral controls', () => {
    expect(contrastRatio('#FFFFFF', brandColors.coral)).toBeLessThan(4.5);
  });
});
