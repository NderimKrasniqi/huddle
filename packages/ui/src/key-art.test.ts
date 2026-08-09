import { KEY_ART_COLOR_NAMES } from '@huddle/game-core';
import { describe, expect, it } from 'vitest';

import { colors } from './colors';

/**
 * game-core lets a Game Module name the color its Key Art is set in, and this
 * is the side that owns what those names are worth: the indexing below only
 * compiles while every `KeyArtColorName` is a Soft Minimal `ColorToken`, so a name
 * added there that Soft Minimal cannot draw fails the typecheck here rather than
 * the carousel on the television.
 */
describe('Key Art colors', () => {
  it('are colors Soft Minimal holds a value for', () => {
    for (const name of KEY_ART_COLOR_NAMES) {
      expect(colors[name]).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});
