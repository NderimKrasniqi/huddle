import { describe, expect, it } from 'vitest';

import type { GameSettingsSchema } from './game-module';
import { defaultSettings, phaseAfter, roomPhase, ROOM_PHASES } from './room-phase';

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
  it('takes a room in its lobby into the game', () => {
    expect(phaseAfter('lobby', 'start')).toEqual({ next: 'in-game' });
  });

  it('brings a room in a game back to the lobby', () => {
    expect(phaseAfter('in-game', 'end')).toEqual({ next: 'lobby' });
  });

  it('refuses to start a second game over the one being played', () => {
    // The refusal is the point: a start that went through would replace the
    // state of a game a room is in the middle of.
    expect(phaseAfter('in-game', 'start')).toEqual({
      refused: { kind: 'alreadyInGame' },
    });
  });

  it('lets a second tap on “End game” ask for the lobby it is already in', () => {
    // Not a rejection: the thumb that hit the button twice wants the screen the
    // room is already on, and there is nothing to tell the person holding it.
    expect(phaseAfter('lobby', 'end')).toEqual({ next: 'lobby' });
  });
});

describe('the settings a game starts with', () => {
  it('is nothing at all for a game that declares no settings', () => {
    expect(defaultSettings([])).toEqual({});
  });

  it('is every setting at the default its schema names', () => {
    const schema: GameSettingsSchema = [
      {
        key: 'scoring',
        label: 'Scoring',
        options: [
          { value: 'flat', label: 'Flat' },
          { value: 'speed', label: 'Speed' },
        ],
        defaultValue: 'flat',
      },
      {
        key: 'questionCount',
        label: 'Questions',
        options: [
          { value: '5', label: '5' },
          { value: '10', label: '10' },
        ],
        defaultValue: '10',
      },
    ];

    // What a Host who never opened the settings screen starts a game with.
    expect(defaultSettings(schema)).toEqual({ scoring: 'flat', questionCount: '10' });
  });
});
