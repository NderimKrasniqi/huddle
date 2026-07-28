import { ROOM_PLAYER_CAP, KEY_ART_COLOR_NAMES } from '@huddle/game-core';
import { triviaGameModule } from '@huddle/game-trivia';
import { describe, expect, it } from 'vitest';

import { GAME_LOGIC_REGISTRY, gameLogicById } from './logic';
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

/**
 * The rules-only view the Convex server imports. It is a second list rather
 * than a projection of the first — that is what keeps the screens out of the
 * server bundle — so the thing worth testing is that the two never drift.
 */
describe('the Registry the server reads', () => {
  it('installs the same games, in the same order', () => {
    expect(GAME_LOGIC_REGISTRY.map((game) => game.metadata.id)).toEqual(
      GAME_REGISTRY.map((game) => game.metadata.id),
    );
  });

  it('is the same rules the clients hold, not a copy of them', () => {
    // Identity, not equality: a module is its logic with screens laid on top,
    // so a second object here would be a second set of rules to keep in step.
    for (const [index, logic] of GAME_LOGIC_REGISTRY.entries()) {
      const module = GAME_REGISTRY[index];

      expect(module?.reduce).toBe(logic.reduce);
      expect(module?.createInitialState).toBe(logic.createInitialState);
      expect(module?.metadata).toBe(logic.metadata);
    }
  });

  it('finds a game by the id a phone names', () => {
    expect(gameLogicById('trivia')).toBe(GAME_LOGIC_REGISTRY[0]);
  });

  it('answers for a game it does not install, rather than throwing', () => {
    // "No such game" is what a room turns into its refusal, so it has to be a
    // value the caller can look at.
    expect(gameLogicById('charades')).toBeUndefined();
  });
});
