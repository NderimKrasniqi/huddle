import { PLAYER_COLOR_NAMES } from '@huddle/game-core';
import { describe, expect, it } from 'vitest';

import { colors } from './colors';
import { playerColor, playerFace, playerPalette } from './player-colors';

/**
 * The palette's two promises, held to arithmetic rather than to taste: ten
 * colors a room can tell apart from a sofa, each of which a monogram can be
 * read on. Both are the kind of thing that looks fine to whoever picks a color
 * and fails for the person sitting furthest from the television, so neither is
 * left to the eye.
 */

const sRgb = (hex: string): readonly number[] =>
  [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);

/** sRGB's transfer function, undone — the linear light a channel actually emits. */
const linear = (channel: number): number =>
  channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const [red = 0, green = 0, blue = 0] = sRgb(hex).map(linear);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG contrast ratio, 1:1 (identical) to 21:1 (black on white). */
function contrast(one: string, other: string): number {
  const [lighter = 0, darker = 0] = [luminance(one), luminance(other)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/** CIE L*a*b*, for asking how different two colors look rather than how different they are. */
function lab(hex: string): readonly [number, number, number] {
  const [red = 0, green = 0, blue = 0] = sRgb(hex).map(linear);
  // D65 white point.
  const x = (0.4124 * red + 0.3576 * green + 0.1805 * blue) / 0.95047;
  const y = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const z = (0.0193 * red + 0.1192 * green + 0.9505 * blue) / 1.08883;
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** How far apart two colors look (CIE76). Below ~10 is a pair people confuse. */
function perceptualDistance(one: string, other: string): number {
  const [oneL, oneA, oneB] = lab(one);
  const [otherL, otherA, otherB] = lab(other);
  return Math.hypot(oneL - otherL, oneA - otherA, oneB - otherB);
}

describe('the contrast maths these promises rest on', () => {
  it('agrees with the two ratios everybody knows', () => {
    // Without this the floors below could be met by an arithmetic slip as
    // easily as by a good palette.
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('calls a color no distance from itself, and black and white a long way apart', () => {
    expect(perceptualDistance(colors.cobalt, colors.cobalt)).toBeCloseTo(0, 5);
    expect(perceptualDistance('#000000', '#FFFFFF')).toBeCloseTo(100, 0);
  });
});

describe('the player palette', () => {
  it('has a color for every name a player can claim, and no others', () => {
    expect(playerPalette.map((color) => color.name)).toEqual([...PLAYER_COLOR_NAMES]);
  });

  it('draws them in the order game-core gives, so the picker is a spectrum', () => {
    // The order is the protocol's, not this file's: the swatches are a walk
    // around the hue wheel, and a palette that re-sorted them would break that
    // without breaking anything a type checker can see.
    expect(playerPalette[0]?.name).toBe('cobalt');
    expect(playerPalette.at(-1)?.name).toBe('sky');
  });

  it('gives every player a different color', () => {
    const fills = playerPalette.map((color) => color.fill);
    expect(new Set(fills).size).toBe(fills.length);
  });

  it('keeps every pair far enough apart to tell across a room', () => {
    // CIE76 ΔE: ~2.3 is the just-noticeable difference under a microscope, ~10
    // is "clearly a different color" side by side. Twelve is the floor because
    // these are not compared side by side — they are two 72px circles at
    // opposite ends of a television, remembered rather than compared.
    const tooClose = playerPalette.flatMap((color, at) =>
      playerPalette.slice(at + 1).flatMap((other) => {
        const apart = perceptualDistance(color.fill, other.fill);
        return apart < 12 ? [`${color.name}/${other.name} = ${apart.toFixed(1)}`] : [];
      }),
    );

    expect(tooClose).toEqual([]);
  });

  it('sets every monogram in something readable on its own fill', () => {
    // Bungee initials are 24px on the TV's design surface and 42px on the
    // phone, which is large text by any reading — WCAG asks 3:1 of it. Every
    // pair here in fact clears 4:1, and the floor is written at the standard's
    // number so a color added later is held to the rule and not to today's
    // luck.
    const unreadable = playerPalette.flatMap((color) => {
      const ratio = contrast(color.fill, color.monogram);
      return ratio < 3 ? [`${color.name} = ${ratio.toFixed(2)}:1`] : [];
    });

    expect(unreadable).toEqual([]);
  });

  it('sets each monogram in whichever of ink and surface reads better on it', () => {
    // The choice is not free: picking the worse of the two is legal under the
    // floor above for most of these fills, and is exactly the mistake that
    // makes one avatar in ten hard to read.
    for (const color of playerPalette) {
      const other = color.monogram === colors.ink ? colors.surface : colors.ink;
      expect(contrast(color.fill, color.monogram)).toBeGreaterThan(
        contrast(color.fill, other),
      );
    }
  });

  it('draws a claimed color the same way wherever it is asked for', () => {
    // The TV's seat and the phone's swatch are the same color or they are a bug.
    for (const { name, ...drawn } of playerPalette) {
      expect(playerColor(name)).toEqual(drawn);
    }
  });

  it('reuses the Boardwalk accents rather than restating them', () => {
    // A player's cobalt has to be the Join button's cobalt; a second value that
    // merely looks the same is a palette that drifts.
    expect(playerColor('cobalt').fill).toBe(colors.cobalt);
    expect(playerColor('punch').fill).toBe(colors.punch);
    expect(playerColor('tangerine').fill).toBe(colors.tangerine);
    expect(playerColor('yellow').fill).toBe(colors.yellow);
    expect(playerColor('green').fill).toBe(colors.green);
  });
});

describe('the face a player is drawn with', () => {
  it('is the color they claimed', () => {
    for (const { name, ...claimed } of playerPalette) {
      expect(playerFace(name)).toEqual(claimed);
    }
  });

  it('is a plain Boardwalk card face until they have claimed one', () => {
    // A player is seated the moment they join and picks a color afterwards, so
    // every surface that draws one has to be drawable without one.
    expect(playerFace(undefined)).toEqual({ fill: colors.surface, monogram: colors.ink });
  });

  it('sets that face’s monogram in something readable too', () => {
    // The floor the ten claimable colors are held to, applied to the eleventh
    // face — an unclaimed seat is read across the same room.
    expect(contrast(playerFace(undefined).fill, playerFace(undefined).monogram)).toBeGreaterThan(3);
  });
});
