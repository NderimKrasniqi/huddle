import { ROOM_PLAYER_CAP } from '@huddle/game-core';
import { describe, expect, it } from 'vitest';

import { triviaGameModule } from './trivia';

describe('the trivia Game Module', () => {
  it('is named the way a room stores it and the carousel draws it', () => {
    expect(triviaGameModule.metadata.id).toBe('trivia');
    expect(triviaGameModule.metadata.title).toBe('Trivia');
  });

  it('is playable by a party the size of a room', () => {
    const { playerRange } = triviaGameModule.metadata;

    // The scope's "2–10 players": two so that somebody is being answered
    // against, and no more than a room seats.
    expect(playerRange.min).toBe(2);
    expect(playerRange.max).toBe(ROOM_PLAYER_CAP);
  });

  it('says how long a game of it runs', () => {
    expect(triviaGameModule.metadata.estimatedMinutes).toBeGreaterThan(0);
  });

  it('is a client view — screens and settings, and none of the rules', () => {
    // The module a client mounts is metadata, the Host's settings schema, and
    // the two screens. It carries no `createInitialState` and no `reduce` on
    // purpose: those deal from and read the Question Pack, and a module holding
    // them would ship every answer to the phone (docs/implementation-plan.md
    // 5.9). What the factory *does* — the players it seats on the scoreboard — is
    // `logic.test.ts`'s business, reached through `triviaGameLogic`, which is the
    // only place the rules live.
    expect(triviaGameModule.settingsSchema.length).toBeGreaterThan(0);
    expect(typeof triviaGameModule.screens.tv).toBe('function');
    expect(typeof triviaGameModule.screens.controller).toBe('function');
    expect(triviaGameModule).not.toHaveProperty('createInitialState');
    expect(triviaGameModule).not.toHaveProperty('reduce');
  });
});
