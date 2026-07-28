import { ROOM_PLAYER_CAP, type GamePlayer } from '@huddle/game-core';
import { describe, expect, it } from 'vitest';

import { triviaGameModule } from './trivia';

function player(playerId: string, nickname: string): GamePlayer {
  return { playerId, nickname, away: false };
}

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

  it('starts with the players it was given', () => {
    const state = triviaGameModule.createInitialState({
      players: [player('p1', 'Ada'), player('p2', 'Grace')],
      settings: undefined,
    });

    expect(state.playerIds).toEqual(['p1', 'p2']);
  });
});
