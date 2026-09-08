import type { GamePlayer } from '@huddle/domain';
import { describe, expect, it } from 'vitest';

import type { PlayableVotingState } from './types';
import { votingTvModel } from './watching';

const players: readonly GamePlayer[] = [
  { playerId: 'ada', nickname: 'Ada', avatar: 'fox', away: false },
  { playerId: 'bo', nickname: 'Bo', avatar: 'green-alien', away: false },
];

const base: PlayableVotingState = {
  prompts: [{ text: 'Pick one', options: ['A', 'B', 'C', 'D'] }],
  roundIndex: 0,
  phase: 'vote',
  voteSeconds: 30,
  results: 'live',
  voterLabels: 'afterReveal',
  playerIds: ['ada', 'bo'],
  votes: {},
  history: [],
  participationCount: 2,
};

describe('Voting TV projection selectors', () => {
  it('fails closed when a live aggregate projection is absent', () => {
    const screen = votingTvModel(base, players);
    expect(screen.kind).toBe('vote');
    if (screen.kind !== 'vote') return;
    expect(screen.options.map(({ count }) => count)).toEqual([0, 0, 0, 0]);
    expect(screen.options.every(({ voters }) => voters.length === 0)).toBe(true);
  });

  it('uses only normalized reveal labels and tally', () => {
    const screen = votingTvModel({
      ...base,
      phase: 'reveal',
      tally: [1, 1, 0, 0],
      revealedVoters: [['ada'], ['bo'], [], []],
    }, players);
    expect(screen.kind).toBe('reveal');
    if (screen.kind !== 'reveal') return;
    expect(screen.options[0]).toMatchObject({ count: 1, percent: 50 });
    expect(screen.options[0]?.voters.map(({ nickname }) => nickname)).toEqual(['Ada']);
  });

  it('never manufactures recap details when the TV projection lacks them', () => {
    expect(votingTvModel({ ...base, phase: 'finished' }, players)).toEqual({ kind: 'finished', recap: [] });
  });
});
