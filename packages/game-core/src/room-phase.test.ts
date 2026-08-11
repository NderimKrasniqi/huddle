import { describe, expect, it } from 'vitest';

import { phaseAfter, refusalToStart, roomPhase, ROOM_PHASES } from './room-phase';

describe('a room’s phase', () => {
  it('is the lobby when the room holds no game', () => {
    expect(roomPhase(undefined)).toBe('lobby');
    // A room read straight out of Convex has `null` for a field it never set.
    expect(roomPhase(null)).toBe('lobby');
  });

  it('is in-game when the room holds one', () => {
    expect(roomPhase({ gameId: 'trivia', state: { playerIds: [] } })).toBe('in-game');
  });

  it('has exactly the two the plan names', () => {
    expect([...ROOM_PHASES]).toEqual(['lobby', 'in-game']);
  });
});

describe('starting and ending a game', () => {
  it('takes a room into the game, and back to its lobby', () => {
    expect(phaseAfter('start')).toBe('in-game');
    expect(phaseAfter('end')).toBe('lobby');
  });
});

describe('whether the room may start a game', () => {
  const twoToTen = { min: 2, max: 10 };

  it('lets a lobby with enough players start', () => {
    expect(refusalToStart('lobby', 2, twoToTen)).toBeNull();
  });

  it('refuses to start a second game over the one being played', () => {
    // The refusal is the point: a start that went through would replace the
    // state of a game a room is in the middle of.
    expect(refusalToStart('in-game', 5, twoToTen)).toEqual({ kind: 'alreadyInGame' });
  });

  it('refuses a party smaller than the game is playable by', () => {
    // Both numbers, because the only useful thing to say to the Host is how
    // many more people have to join.
    expect(refusalToStart('lobby', 1, twoToTen)).toEqual({
      kind: 'notEnoughPlayers',
      need: 2,
      have: 1,
    });
  });

  it('refuses an empty room the same way', () => {
    expect(refusalToStart('lobby', 0, twoToTen)).toEqual({
      kind: 'notEnoughPlayers',
      need: 2,
      have: 0,
    });
  });

  it('lets a game playable alone be started alone', () => {
    expect(refusalToStart('lobby', 1, { min: 1, max: 10 })).toBeNull();
  });

  it('tells a room mid-game that first, whoever is in it', () => {
    // A room already playing hears the same refusal however big the party is,
    // so the Host is never sent hunting for players over a game in progress.
    expect(refusalToStart('in-game', 0, twoToTen)).toEqual({ kind: 'alreadyInGame' });
  });

  it('refuses a room that has outgrown a game', () => {
    expect(refusalToStart('lobby', 6, { min: 2, max: 4 })).toEqual({
      kind: 'tooManyPlayers',
      max: 4,
      have: 6,
    });
  });
});

// The settings a game starts with moved to `game-settings.test.ts` when the
// Host gained a say in them: defaulting and refusing are one decision now, and
// they are asserted together, beside the schema they read.
