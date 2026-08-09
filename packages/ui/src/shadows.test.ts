import { describe, expect, it } from 'vitest';

import { colors } from './colors';
import { elevation } from './shadows';

/**
 * The old suite tested `stickerShadowRect`: that a shadow was displaced down
 * *and right* by an equal distance, and stayed the surface's own size. That was
 * Boardwalk's whole signature and it is exactly what Soft Minimal removes, so
 * the promises below are the opposite ones.
 */
const SHADOW = /^0px (\d+)px (\d+)px (#[0-9A-F]{8})$/;

describe('the elevation scale', () => {
  it('casts every shadow straight down, never sideways', () => {
    // The `0px` first field is the point: a sideways offset is what made a
    // Boardwalk card read as a sticker lifted off the page.
    for (const shadow of Object.values(elevation)) {
      expect(shadow).toMatch(SHADOW);
    }
  });

  it('blurs every shadow, because a hard edge is the old system', () => {
    for (const shadow of Object.values(elevation)) {
      const [, , blur] = SHADOW.exec(shadow) ?? [];

      expect(Number(blur)).toBeGreaterThan(0);
    }
  });

  it('blurs further than it drops, so nothing reads as a hard slab', () => {
    for (const shadow of Object.values(elevation)) {
      const [, drop, blur] = SHADOW.exec(shadow) ?? [];

      expect(Number(blur)).toBeGreaterThan(Number(drop));
    }
  });

  it('is cast in the theme’s own shadow inks and no others', () => {
    const inks = new Set<string>([colors.shadowSoft, colors.shadowMedium, colors.shadowStrong]);

    for (const shadow of Object.values(elevation)) {
      const [, , , ink] = SHADOW.exec(shadow) ?? [];

      expect(inks).toContain(ink);
    }
  });

  it('lifts a TV hero further than a resting phone surface', () => {
    const drop = (shadow: string) => Number(SHADOW.exec(shadow)?.[1]);

    expect(drop(elevation.tvHero)).toBeGreaterThan(drop(elevation.tvCard));
    expect(drop(elevation.tvCard)).toBeGreaterThan(drop(elevation.phoneSmall));
    expect(drop(elevation.phoneCard)).toBeGreaterThan(drop(elevation.phoneSmall));
  });
});
