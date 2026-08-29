import {
  KEY_ART_COLOR_NAMES,
  type GameSettingsSchema,
} from '@huddle/contracts';
import { ROOM_PLAYER_CAP } from '@huddle/domain';
import { triviaGameModule } from '@huddle/game-trivia';
import { votingGameModule } from '@huddle/game-voting';
import { describe, expect, it } from 'vitest';

import { CAROUSEL_REGISTRY } from './carousel';
import { CAROUSEL_PLACEHOLDER_IDS } from './carousel-catalog';
import { GAME_LOGIC_REGISTRY, gameLogicById } from './logic';
import { GAME_REGISTRY } from './registry';

/**
 * The settings whose default is not one of the values they offer — the keys, so
 * a failure names the setting rather than just denying a boolean.
 *
 * It is a function so the rule can be aimed at something other than the
 * Registry: trivia declares no settings yet, so applied to what is installed
 * today it looks at nothing at all, and a check that cannot fail is worth
 * exactly as much as no check.
 */
function settingsDefaultingOutsideTheirOptions(schema: GameSettingsSchema): string[] {
  return schema
    .filter((setting) => !setting.options.some((option) => option.value === setting.defaultValue))
    .map((setting) => setting.key);
}

/**
 * The Registry is the hub's whole list of games, so what is tested here is what
 * the hub is entitled to assume about an entry — every invariant below is
 * something a hub screen would otherwise have to check, or get wrong, per game.
 */
describe('the Registry', () => {
  it('installs trivia and the voting game, in that order', () => {
    expect(GAME_REGISTRY).toEqual([triviaGameModule, votingGameModule]);
  });

  it('keeps the reference-only cards in the carousel without installing them', () => {
    expect(CAROUSEL_REGISTRY.map((game) => game.metadata.id)).toEqual([
      ...GAME_REGISTRY.map((game) => game.metadata.id),
      ...CAROUSEL_PLACEHOLDER_IDS,
    ]);
    expect(CAROUSEL_REGISTRY.slice(GAME_REGISTRY.length).every((game) => game.placeholder)).toBe(
      true,
    );
  });

  it('uses the approved four-card lineup', () => {
    expect(CAROUSEL_REGISTRY.map((game) => game.metadata.title)).toEqual([
      'Trivia',
      'Voting',
      'Word Battle',
      'More Games',
    ]);
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
      expect(settingsDefaultingOutsideTheirOptions(settingsSchema)).toEqual([]);
    }
  });

  it('would say so if a game did', () => {
    // Aim the same rule at a deliberately broken declaration so this test proves
    // the guard itself, independently of the currently installed schemas.
    expect(
      settingsDefaultingOutsideTheirOptions([
        {
          key: 'scoring',
          label: 'Scoring',
          options: [{ value: 'flat', label: 'Flat' }],
          defaultValue: 'speed',
        },
      ]),
    ).toEqual(['scoring']);
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

  it('shares one metadata and schema with the rules, and carries none of the rules', () => {
    // Two views of one game, held to each other by the objects they point at
    // rather than by copies kept in step: same `metadata`, same `settingsSchema`,
    // by identity. What the module must *not* share is the rules —
    // `createInitialState` deals from the Question Pack, so a module carrying it
    // would carry the pack into the client bundle (docs/implementation-plan.md
    // 5.9). That the module has no rules on it is the seam, asserted here rather
    // than trusted: a spread of the logic would quietly put them back.
    for (const [index, logic] of GAME_LOGIC_REGISTRY.entries()) {
      const module = GAME_REGISTRY[index];

      expect(module?.metadata).toBe(logic.metadata);
      expect(module?.settingsSchema).toBe(logic.settingsSchema);
      expect(module).not.toHaveProperty('createInitialState');
      expect(module).not.toHaveProperty('reduce');
    }
  });

  it('finds a game by the id a phone names', () => {
    expect(gameLogicById('trivia')).toBe(GAME_LOGIC_REGISTRY[0]);
    expect(gameLogicById('voting')).toBe(GAME_LOGIC_REGISTRY[1]);
  });

  it('answers for a game it does not install, rather than throwing', () => {
    // "No such game" is what a room turns into its refusal, so it has to be a
    // value the caller can look at.
    expect(gameLogicById('charades')).toBeUndefined();
    expect(gameLogicById(CAROUSEL_PLACEHOLDER_IDS[0])).toBeUndefined();
    expect(gameLogicById(CAROUSEL_PLACEHOLDER_IDS[1])).toBeUndefined();
  });
});
