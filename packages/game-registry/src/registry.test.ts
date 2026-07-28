import { ROOM_PLAYER_CAP, KEY_ART_COLOR_NAMES } from '@huddle/game-core';
import { triviaGameModule } from '@huddle/game-trivia';
import { describe, expect, it } from 'vitest';

import { GAME_REGISTRY } from './registry';

/**
 * The Registry is the hub's whole list of games, so what is tested here is what
 * the hub is entitled to assume about an entry — every invariant below is
 * something a hub screen would otherwise have to check, or get wrong, per game.
 */
describe('the Registry', () => {
  it('installs trivia, and for now nothing else', () => {
    expect(GAME_REGISTRY).toEqual([triviaGameModule]);
  });

  it('gives every game a name of its own, since a room stores the id', () => {
    const ids = GAME_REGISTRY.map((game) => game.metadata.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives the carousel a card it can draw for every game', () => {
    for (const { metadata } of GAME_REGISTRY) {
      expect(metadata.title).not.toBe('');
      expect(KEY_ART_COLOR_NAMES).toContain(metadata.keyArt.color);
      expect(metadata.category).not.toBe('');
      expect(metadata.estimatedMinutes).toBeGreaterThan(0);
    }
  });

  it('offers no game a room could not seat', () => {
    for (const { metadata } of GAME_REGISTRY) {
      expect(metadata.playerRange.min).toBeGreaterThanOrEqual(1);
      expect(metadata.playerRange.min).toBeLessThanOrEqual(metadata.playerRange.max);
      expect(metadata.playerRange.max).toBeLessThanOrEqual(ROOM_PLAYER_CAP);
    }
  });

  it('leaves no setting without a value the Host has not chosen yet', () => {
    for (const { settingsSchema } of GAME_REGISTRY) {
      for (const setting of settingsSchema) {
        expect(setting.options.map((option) => option.value)).toContain(setting.defaultValue);
      }
    }
  });
});
