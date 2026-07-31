import { describe, expect, it } from 'vitest';

import { GAME_REGISTRY } from './registry';
import { gameModuleById, runningGameScreen } from './running';

const trivia = GAME_REGISTRY[0];

describe('what a client draws for the room’s running game', () => {
  it('draws the lobby when the room is playing nothing', () => {
    expect(runningGameScreen(null)).toEqual({ kind: 'lobby' });
  });

  it('draws the lobby while the subscription is still in flight', () => {
    // The client is already on its lobby when it asks, so the in-flight moment
    // has to draw that rather than flash something else on the way to it.
    expect(runningGameScreen(undefined)).toEqual({ kind: 'lobby' });
  });

  it('mounts the module the room named, on the state the room stored', () => {
    const state = { playerIds: ['p1', 'p2'] };

    expect(runningGameScreen({ gameId: 'trivia', state })).toEqual({
      kind: 'game',
      module: trivia,
      state,
    });
  });

  it('hands the state through untouched, whatever it is', () => {
    // The hub stores and returns a game's state without reading it, and this is
    // the client half of that promise.
    const opaque = { anything: { at: ['all'] } };
    const screen = runningGameScreen({ gameId: 'trivia', state: opaque });

    expect(screen.kind === 'game' && screen.state).toBe(opaque);
  });

  it('says so when the room is playing something this build lacks', () => {
    // An un-updated phone walking into a room whose TV has been updated. Not
    // the lobby: a lobby would invite the player to act on a room mid-game.
    expect(runningGameScreen({ gameId: 'charades', state: {} })).toEqual({
      kind: 'unknownGame',
      gameId: 'charades',
    });
  });
});

describe('finding an installed module by id', () => {
  it('finds the one the Registry installs', () => {
    expect(gameModuleById('trivia')).toBe(trivia);
  });

  it('answers for a game it does not install, rather than throwing', () => {
    expect(gameModuleById('charades')).toBeUndefined();
  });
});
