import { describe, expect, it } from 'vitest';

import { tvPurposeForSurface } from './tv-purpose';

describe('TV purpose mapping', () => {
  it.each([
    ['room', 'lobby', undefined, 'Room invitation'],
    ['carousel', 'lobby', undefined, 'Choose a game'],
    ['setup', 'lobby', undefined, 'Game setup'],
    ['runtime-status', 'paused', undefined, 'Game paused'],
    ['runtime-status', 'unavailable', undefined, 'Game unavailable'],
    ['game', 'finished', 'trivia', 'Game finished'],
    ['game', 'game', 'trivia', 'Trivia game'],
    ['game', 'game', 'voting', 'Voting game'],
  ] as const)('maps %s/%s', (surface, runtime, gameId, purpose) => {
    expect(tvPurposeForSurface(surface, runtime, gameId)).toBe(purpose);
  });
});
