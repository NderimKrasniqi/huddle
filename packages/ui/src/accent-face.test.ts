import { describe, expect, it } from 'vitest';

import { accentFace } from './accent-face';
import { colors } from './colors';

/**
 * The one cycle Soft Minimal still runs: a game's answer options, which have to
 * be told apart at a glance and told apart the same way on both surfaces.
 */
describe('an accent face', () => {
  it('runs four faces the palette actually holds', () => {
    expect([0, 1, 2, 3].map((index) => accentFace(index).fill)).toEqual([
      colors.accent,
      colors.ink,
      colors.sage,
      colors.justJoined,
    ]);
  });

  it('cycles, so every position has a face', () => {
    // A caller with five of something gets a fifth face rather than a hole.
    expect(accentFace(4)).toEqual(accentFace(0));
    expect(accentFace(-1)).toEqual(accentFace(1));
  });

  // The pairing used to be borrowed from `player-colors.ts`, which held it to a
  // contrast floor. That module is on its way out with the color picker, so the
  // promise is made here directly rather than inherited from something leaving.
  //
  // 3:1 is WCAG AA for large text, which is what these labels are on both
  // surfaces — an option is a headline, never a sentence. It is also the floor
  // that catches the mistake worth catching: white on the brand orange is
  // 2.82:1 and would fail here, which is how the face above came to take navy.
  it('sets its label in an ink that actually reads on the fill', () => {
    for (const position of [0, 1, 2, 3]) {
      const { fill, label } = accentFace(position);
      expect(contrast(fill, label)).toBeGreaterThanOrEqual(3);
    }
  });
});

/** Relative luminance per WCAG 2.1, for the ratio below. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255);

  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];

  return (lighter + 0.05) / (darker + 0.05);
}
