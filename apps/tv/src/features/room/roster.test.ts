import { ROOM_PLAYER_CAP } from '@huddle/domain';
import { describe, expect, it } from 'vitest';

import {
  roomCountLine,
  roomSeats,
  type RosterSeat,
  seatSlot,
  seatSpokenAs,
} from './roster';

const seatOf = (nickname: string, extra: Partial<RosterSeat> = {}): RosterSeat => ({
  playerId: `player-${nickname}` as RosterSeat['playerId'],
  nickname,
  away: false,
  host: false,
  avatar: 'fox',
  ...extra,
});

const ada = seatOf('Ada', { host: true });
const grace = seatOf('Grace');
const alan = seatOf('Alan', { away: true });

describe('roomSeats', () => {
  it('keeps the fixed room capacity visible', () => {
    expect(roomSeats([])).toHaveLength(ROOM_PLAYER_CAP);
    expect(roomSeats([ada, grace])).toHaveLength(ROOM_PLAYER_CAP);
  });

  it('places occupied seats before available positions', () => {
    expect(roomSeats([ada, grace]).slice(0, 3)).toEqual([
      { kind: 'taken', seat: ada },
      { kind: 'taken', seat: grace },
      { kind: 'empty', number: 3 },
    ]);
  });

  it('does not drop an over-capacity roster', () => {
    const roster = Array.from({ length: ROOM_PLAYER_CAP + 1 }, (_unused, index) =>
      seatOf(`Player ${index}`),
    );

    expect(roomSeats(roster)).toHaveLength(ROOM_PLAYER_CAP + 1);
  });
});

describe('seatSlot', () => {
  it('prioritizes a just-joined state', () => {
    expect(seatSlot(ada, true)).toBe('justJoined');
    expect(seatSlot(alan, true)).toBe('justJoined');
  });

  it('prioritizes the Host state once the greeting ends', () => {
    expect(seatSlot(ada, false)).toBe('host');
    expect(seatSlot(seatOf('Ada', { host: true, away: true }), false)).toBe('host');
  });

  it('preserves away and present states', () => {
    expect(seatSlot(alan, false)).toBe('away');
    expect(seatSlot(grace, false)).toBe('present');
  });
});

describe('seatSpokenAs', () => {
  it('returns the semantic roster description', () => {
    expect(seatSpokenAs(ada, false)).toBe('Ada, host');
    expect(seatSpokenAs(grace, false)).toBe('Grace, online');
    expect(seatSpokenAs(alan, false)).toBe('Alan, away');
    expect(seatSpokenAs(grace, true)).toBe('Grace, just joined');
  });
});

describe('roomCountLine', () => {
  it('waits for players in an empty room', () => {
    expect(roomCountLine(0, undefined)).toEqual({
      joined: 0,
      total: ROOM_PLAYER_CAP,
      note: 'waiting for players…',
    });
  });

  it('names the Host when a room can be started', () => {
    expect(roomCountLine(6, 'Sam')).toEqual({
      joined: 6,
      total: ROOM_PLAYER_CAP,
      note: 'Sam can start whenever',
    });
  });

  it('omits a note when there is no Host to name', () => {
    expect(roomCountLine(2, undefined).note).toBeUndefined();
  });
});
