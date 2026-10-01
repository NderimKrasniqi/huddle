import { describe, expect, it } from 'vitest';

import { readiness } from './readiness';

const twoToTen = { min: 2, max: 10 };
const seats = [
  { playerId: 'host', away: false },
  { playerId: 'guest', away: false },
];

describe('the ready check', () => {
  it('is complete once a locked setup has every present seat Ready', () => {
    expect(readiness({ stage: 'ready', seats, readyPlayerIds: ['host', 'guest'], playerRange: twoToTen }))
      .toMatchObject({ complete: true, readyCount: 2, seatCount: 2, waitingPlayerIds: [] });
  });

  it('stays complete while the room is counting down', () => {
    expect(readiness({ stage: 'countdown', seats, readyPlayerIds: ['host', 'guest'], playerRange: twoToTen }).complete)
      .toBe(true);
  });

  it('names who the room is still waiting for', () => {
    expect(readiness({ stage: 'ready', seats, readyPlayerIds: ['host'], playerRange: twoToTen }))
      .toMatchObject({ complete: false, readyCount: 1, waitingPlayerIds: ['guest'] });
  });

  it('is never complete while the Host is still editing', () => {
    expect(readiness({ stage: 'configuring', seats, readyPlayerIds: ['host', 'guest'], playerRange: twoToTen }).complete)
      .toBe(false);
  });

  it('does not count an away seat as ready and blocks on it', () => {
    const result = readiness({
      stage: 'ready',
      seats: [{ playerId: 'host', away: false }, { playerId: 'guest', away: true }],
      readyPlayerIds: ['host', 'guest'],
      playerRange: twoToTen,
    });
    expect(result).toMatchObject({ complete: false, allPresent: false, allReady: true, readyCount: 1 });
  });

  it('blocks a party outside the game’s range, and fails closed without one', () => {
    expect(readiness({ stage: 'ready', seats: seats.slice(0, 1), readyPlayerIds: ['host'], playerRange: twoToTen }).complete)
      .toBe(false);
    expect(readiness({ stage: 'ready', seats, readyPlayerIds: ['host', 'guest'], playerRange: undefined }).complete)
      .toBe(false);
  });

  it('is not complete for an empty room', () => {
    expect(readiness({ stage: 'ready', seats: [], readyPlayerIds: [], playerRange: { min: 0, max: 10 } }).complete)
      .toBe(false);
  });
});
