import { describe, expect, it } from 'vitest';

import { phonePurposeForSurface } from './phone-purpose';
import type { RunningGameScreen } from '@huddle/game-registry';

const lobby = { kind: 'lobby' } satisfies RunningGameScreen;
const game = (id: 'trivia' | 'voting'): RunningGameScreen =>
  ({ kind: 'game', module: { metadata: { id } } } as RunningGameScreen);

describe('Phone purpose mapping', () => {
  it.each([
    ['room', false, 'Room lobby'],
    ['waiting', false, 'Waiting for the Host'],
    ['picker', false, 'Choose a game'],
    ['picker', true, 'Game setup'],
  ] as const)('maps %s', (surface, hasSetup, purpose) => {
    expect(phonePurposeForSurface(surface, lobby, hasSetup)).toBe(purpose);
  });

  it('maps paused, unavailable, finished, and both modules', () => {
    expect(phonePurposeForSurface('runtime-status', { kind: 'paused', gameId: 'x', reason: 'tvDisconnected' }, false)).toBe('Game paused');
    expect(phonePurposeForSurface('runtime-status', { kind: 'unavailable', gameId: 'x' }, false)).toBe('Game unavailable');
    expect(phonePurposeForSurface('finished', { kind: 'finished', module: { metadata: { id: 'trivia' } }, state: {}, gameId: 'trivia' } as RunningGameScreen, false)).toBe('Game finished');
    expect(phonePurposeForSurface('game', game('trivia'), false)).toBe('Trivia game');
    expect(phonePurposeForSurface('game', game('voting'), false)).toBe('Voting game');
  });
});
