import { describe, expect, it } from 'vitest';

import type { RosterSeat } from './host';
import { seatLossNotice } from './seat-loss';

/** A roster seat with only the fields this rule reads; the rest is filler. */
function seat(nickname: string): RosterSeat {
  return {
    playerId: `player_${nickname}` as RosterSeat['playerId'],
    nickname,
    away: false,
    host: false,
    color: undefined,
  };
}

describe('seatLossNotice', () => {
  it('names a removal when the room is still standing', () => {
    // The Host who did the removing is still in it, so the roster this phone was
    // watching still has people on it.
    expect(seatLossNotice([seat('Ada')])).toBe('The host removed you from the room.');
  });

  it('names a closed room when every seat is gone', () => {
    // An ended or expired room takes the whole roster with it.
    expect(seatLossNotice([])).toBe('This room has closed.');
  });
});
