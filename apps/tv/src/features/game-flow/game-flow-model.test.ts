import { describe, expect, it, vi } from 'vitest';

import { tvHostCopy, tvReadiness, visibleTvSetupSettings } from './game-flow-model';

vi.mock('./assets', () => ({
  gameCardAsset: (id: string) => ({ test: id }),
}));

describe('TV game-flow model', () => {
  it('uses neutral host copy when the roster has no host name', () => {
    expect(tvHostCopy(undefined, 'is choosing a game.')).toBe('the host is choosing a game.');
    expect(tvHostCopy('  ', 'is choosing a game.')).toBe('the host is choosing a game.');
  });

  it('renders only module-declared settings and resolves option labels', () => {
    expect(visibleTvSetupSettings('trivia', { questions: '5', difficulty: 'hard' })).toEqual([
      { key: 'questions', label: 'Questions', value: '5' },
    ]);
    expect(visibleTvSetupSettings('voting', undefined)).toEqual([
      { key: 'rounds', label: 'Rounds', value: '3' },
    ]);
    expect(visibleTvSetupSettings('trivia', [
      { key: 'questions', value: '5', label: 'Invented label' },
    ])).toEqual([{ key: 'questions', label: 'Questions', value: '5' }]);
  });

  it('mirrors the exact ready gate and never counts away players as ready', () => {
    const players = [
      { id: 'host', name: 'Host', isHost: true },
      { id: 'guest', name: 'Guest' },
    ];
    expect(tvReadiness({ gameId: 'trivia', stage: 'ready', players, readyPlayerIds: ['host', 'guest'] }).allReady).toBe(true);
    expect(tvReadiness({ gameId: 'trivia', stage: 'configuring', players, readyPlayerIds: ['host', 'guest'] }).allReady).toBe(false);
    expect(tvReadiness({
      gameId: 'trivia',
      stage: 'ready',
      players: [{ id: 'host', name: 'Host' }, { id: 'guest', name: 'Guest', away: true }],
      readyPlayerIds: ['host', 'guest'],
    })).toMatchObject({ readyCount: 1, allReady: false });

    expect(tvReadiness({
      gameId: 'custom-game',
      playerRange: { min: 3, max: 4 },
      stage: 'ready',
      players: [{ id: 'host', name: 'Host' }, { id: 'guest', name: 'Guest' }],
      readyPlayerIds: ['host', 'guest'],
    }).allReady).toBe(false);
    expect(tvReadiness({
      gameId: 'not-installed',
      stage: 'ready',
      players,
      readyPlayerIds: ['host', 'guest'],
    }).allReady).toBe(false);
  });
});
