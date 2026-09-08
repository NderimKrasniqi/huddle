import type { GamePlayer } from '@huddle/domain';
import { describe, expect, it } from 'vitest';

import {
  introDeadline,
  NO_TIMER_SAFETY_MS,
  redactVotingStateFor,
  revealDeadline,
  voteDeadline,
  votingGameLogic,
  votingRecap,
} from './logic';
import type { PlayableVotingState, VotingEvent } from './types';

const ADA = 'ada';
const BO = 'bo';
const CY = 'cy';
const players: readonly GamePlayer[] = [
  { playerId: ADA, nickname: 'Ada', avatar: 'fox', away: false },
  { playerId: BO, nickname: 'Bo', avatar: 'green-alien', away: false },
  { playerId: CY, nickname: 'Cy', avatar: 'purple-owl', away: false },
];

function started(settings: Record<string, string> = {}): PlayableVotingState {
  return votingGameLogic.createInitialState({ players, settings }) as PlayableVotingState;
}

function reduce(state: PlayableVotingState, event: VotingEvent): PlayableVotingState {
  return votingGameLogic.reduce(state, event) as PlayableVotingState;
}

function opened(state = started()): PlayableVotingState {
  return reduce(state, { kind: 'advance', roundIndex: 0, phase: 'intro' });
}

describe('Voting rules', () => {
  it('creates a playable deterministic run while retaining strict legacy decoding', () => {
    const first = started({ rounds: '7', voteSeconds: '45', results: 'live', voterLabels: 'afterReveal' });
    const again = started({ rounds: '7', voteSeconds: '45', results: 'live', voterLabels: 'afterReveal' });
    expect(first.phase).toBe('intro');
    expect(first.prompts).toHaveLength(7);
    expect(first.prompts).toEqual(again.prompts);
    expect(first.playerIds).toEqual([ADA, BO, CY]);
    expect(votingGameLogic.decodeState({ phase: 'entered', resolvedSettings: { rounds: 5 } })).toEqual({
      phase: 'entered',
      resolvedSettings: { rounds: 5 },
    });
    expect(() => votingGameLogic.decodeState({ phase: 'entered', resolvedSettings: { rounds: 7 } })).toThrow();
    expect(() => votingGameLogic.decodeState({ ...first, surprise: true })).toThrow();
  });

  it('strictly decodes player votes and server advance events', () => {
    expect(votingGameLogic.decodeEvent({ kind: 'vote', playerId: ADA, roundIndex: 0, optionIndex: 2 })).toEqual({
      kind: 'vote', playerId: ADA, roundIndex: 0, optionIndex: 2,
    });
    expect(() => votingGameLogic.decodeEvent({ kind: 'vote', playerId: ADA, roundIndex: 0, optionIndex: 4 })).toThrow();
    expect(() => votingGameLogic.decodeEvent({ kind: 'advance', roundIndex: 0, phase: 'vote', extra: true })).toThrow();
  });

  it('locks the first valid vote and reveals when every present player has voted', () => {
    const vote = opened();
    const once = reduce(vote, { kind: 'vote', playerId: ADA, roundIndex: 0, optionIndex: 1 });
    const twice = reduce(once, { kind: 'vote', playerId: ADA, roundIndex: 0, optionIndex: 3 });
    expect(twice.votes).toEqual({ [ADA]: 1 });

    const two = reduce(twice, { kind: 'vote', playerId: BO, roundIndex: 0, optionIndex: 1 });
    const revealed = reduce(two, { kind: 'vote', playerId: CY, roundIndex: 0, optionIndex: 2 });
    expect(revealed.phase).toBe('reveal');
    expect(revealed.history[0]?.counts).toEqual([0, 2, 1, 0]);
  });

  it('does not wait for away players after a present vote arrives', () => {
    const vote = opened();
    const one = reduce(vote, { kind: 'vote', playerId: ADA, roundIndex: 0, optionIndex: 0, awayPlayerIds: [CY] });
    const revealed = reduce(one, { kind: 'vote', playerId: BO, roundIndex: 0, optionIndex: 1, awayPlayerIds: [CY] });
    expect(revealed.phase).toBe('reveal');
  });

  it('ignores forged and stale advances, then moves reveal to the next round', () => {
    const vote = opened();
    expect(reduce(vote, { kind: 'advance', playerId: ADA, roundIndex: 0, phase: 'vote' })).toBe(vote);
    expect(reduce(vote, { kind: 'advance', roundIndex: 1, phase: 'vote' })).toBe(vote);
    const reveal = reduce(vote, { kind: 'advance', roundIndex: 0, phase: 'vote' });
    expect(reveal.phase).toBe('reveal');
    const next = reduce(reveal, { kind: 'advance', roundIndex: 0, phase: 'reveal' });
    expect(next).toMatchObject({ phase: 'vote', roundIndex: 1, votes: {} });
  });

  it('uses server deadlines, including a hidden safety deadline for No timer', () => {
    const intro = started({ voteSeconds: 'none' });
    const vote = opened(intro);
    const reveal = reduce(vote, { kind: 'advance', roundIndex: 0, phase: 'vote' });
    expect(introDeadline(intro)).toMatchObject({ afterMs: 3_000, beat: '0:intro' });
    expect(voteDeadline(vote)).toMatchObject({ afterMs: NO_TIMER_SAFETY_MS, beat: '0:vote' });
    expect(revealDeadline(reveal)).toMatchObject({ afterMs: 7_000, beat: '0:reveal' });
  });

  it('does not invent recap claims for rounds where nobody voted', () => {
    const state = started();
    expect(votingRecap({
      ...state,
      phase: 'finished',
      history: [{ promptIndex: 0, counts: [0, 0, 0, 0] }],
    })).toEqual([]);
  });
});

describe('Voting viewer projection', () => {
  function partlyVoted(settings: Record<string, string> = {}): PlayableVotingState {
    return reduce(
      reduce(opened(started(settings)), { kind: 'vote', playerId: ADA, roundIndex: 0, optionIndex: 1 }),
      { kind: 'vote', playerId: BO, roundIndex: 0, optionIndex: 2 },
    );
  }

  it('gives a phone only its own locked choice and withholds every future prompt', () => {
    const stored = partlyVoted();
    const ada = redactVotingStateFor(stored, ADA) as PlayableVotingState;
    const cy = redactVotingStateFor(stored, CY) as PlayableVotingState;
    expect(ada.votes).toEqual({ [ADA]: 1 });
    expect(cy.votes).toEqual({});
    expect(ada.tally).toBeUndefined();
    expect(ada.participationCount).toBe(2);
    expect(cy.participationCount).toBe(2);
    expect(ada.history).toEqual([]);
    expect(ada.prompts[0]?.text).not.toBe('');
    expect(ada.prompts.slice(1).every(({ text }) => text === '')).toBe(true);
  });

  it('keeps reveal-together neutral but gives live mode only aggregate TV counts', () => {
    const together = redactVotingStateFor(partlyVoted(), undefined) as PlayableVotingState;
    const live = redactVotingStateFor(partlyVoted({ results: 'live' }), undefined) as PlayableVotingState;
    expect(together.votes).toEqual({});
    expect(together.participationCount).toBe(2);
    expect(together.tally).toBeUndefined();
    expect(live.tally).toEqual([0, 1, 1, 0]);
    expect(live.revealedVoters).toBeUndefined();
  });

  it('reveals aggregate results and optional labels only to the TV', () => {
    const stored = reduce(
      partlyVoted({ voterLabels: 'afterReveal' }),
      { kind: 'advance', roundIndex: 0, phase: 'vote' },
    );
    const tv = redactVotingStateFor(stored, undefined) as PlayableVotingState;
    const phone = redactVotingStateFor(stored, ADA) as PlayableVotingState;
    expect(tv.votes).toEqual({});
    expect(tv.tally).toEqual([0, 1, 1, 0]);
    expect(tv.revealedVoters).toEqual([[], [ADA], [BO], []]);
    expect(tv.prompts[0]?.text).not.toBe('');
    expect(phone.prompts.every(({ text }) => text === '')).toBe(true);
    expect(phone.votes).toEqual({});
    expect(phone.tally).toBeUndefined();
    expect(phone.revealedVoters).toBeUndefined();
  });

  it('sends only an aggregate room-vibe recap to the finished TV', () => {
    let state = started({ rounds: '3' });
    state = opened(state);
    for (let round = 0; round < 3; round += 1) {
      state = reduce(state, { kind: 'vote', playerId: ADA, roundIndex: round, optionIndex: round === 1 ? 0 : 1 });
      state = reduce(state, { kind: 'vote', playerId: BO, roundIndex: round, optionIndex: round === 2 ? 2 : 1 });
      state = reduce(state, { kind: 'vote', playerId: CY, roundIndex: round, optionIndex: round === 0 ? 1 : 3 });
      state = reduce(state, { kind: 'advance', roundIndex: round, phase: 'reveal' });
    }
    expect(state.phase).toBe('finished');
    const tv = redactVotingStateFor(state, undefined) as PlayableVotingState;
    const phone = redactVotingStateFor(state, ADA) as PlayableVotingState;
    expect(tv.recap?.map(({ kind }) => kind)).toEqual(['agreement', 'closest', 'wildcard']);
    expect(tv.history).toEqual([]);
    expect(tv.votes).toEqual({});
    expect(tv.prompts.every(({ text }) => text === '')).toBe(true);
    expect(phone.recap).toBeUndefined();
    expect(phone.history).toEqual([]);
  });
});
