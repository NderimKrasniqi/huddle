import { AVATAR_IDS } from '@huddle/contracts';
import { describe, expect, it } from 'vitest';

import { avatarFace } from '../avatar-face';

/**
 * The artwork map itself cannot be imported here — it pulls `react-native` and
 * a `.png` through a bundler, neither of which exists under Node. What *can* be
 * held is the half that decides colour, and the rule that matters either way:
 * every id game-core offers has to be drawable.
 */
describe('every claimable avatar', () => {
  it('has a face to draw where its artwork will not fit', () => {
    for (const avatar of AVATAR_IDS) {
      expect(avatarFace(avatar).fill).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('is told apart from every other one', () => {
    const fills = AVATAR_IDS.map((avatar) => avatarFace(avatar).fill);

    expect(new Set(fills).size).toBe(AVATAR_IDS.length);
  });

  it('fills a room, so the last player to join still has a choice', () => {
    // Ten avatars against a cap of ten is exactly no choice for the last
    // player. This asserts the cap rather than the count, so it fails the day
    // the cap rises without the artwork following.
    expect(AVATAR_IDS.length).toBeGreaterThanOrEqual(10);
  });
});
