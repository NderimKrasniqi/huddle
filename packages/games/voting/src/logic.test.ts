import type { GamePlayer } from '@huddle/game-core';
import { describe, expect, it } from 'vitest';

import {
  REVEAL_SECONDS,
  VOTE_SECONDS,
  votingGameLogic,
  type VotingEvent,
  type VotingState,
} from './logic';

/**
 * The Voting game's rules are the half that runs inside a Convex mutation, so
 * they are what is tested here — the screens are drawn from `voting-controller`
 * and `voting-tv`, which have their own suites. The reducer is pure, so every
 * case is a state and an event against the state they produce, and the refusals
 * matter as much as the moves: the hub stores a reducer's output unexamined, so
 * a no-op has to be the *same* state, and a rule that fired when it should not
 * have would corrupt the room in silence.
 */

function player(id: string, away = false): GamePlayer {
  return { playerId: id, nickname: id.toUpperCase(), away };
}

/** A game freshly started with the given players and round count. */
function started(playerIds: string[], rounds = 3): VotingState {
  return votingGameLogic.createInitialState({
    players: playerIds.map((id) => player(id)),
    settings: { rounds: String(rounds) },
  });
}

const vote = (
  playerId: string,
  promptIndex: number,
  optionIndex: number,
): Extract<VotingEvent, { kind: 'vote' }> => ({
  kind: 'vote',
  playerId,
  promptIndex,
  optionIndex,
});

describe('starting a game of Voting', () => {
  it('deals as many prompts as the Host chose', () => {
    expect(started(['a', 'b'], 3).prompts).toHaveLength(3);
    expect(started(['a', 'b'], 5).prompts).toHaveLength(5);
  });

  it('opens on the first prompt with an empty, correctly-sized tally', () => {
    const state = started(['a', 'b']);

    expect(state.phase).toBe('voting');
    expect(state.promptIndex).toBe(0);
    expect(state.voters).toEqual([]);
    expect(state.tally).toEqual(state.prompts[0]?.options.map(() => 0));
    expect(state.players).toEqual(['a', 'b']);
  });
});

describe('casting a vote', () => {
  it('records that a player voted and adds one to that option, anonymously', () => {
    const next = votingGameLogic.reduce(started(['a', 'b']), vote('a', 0, 1));

    expect(next.voters).toEqual(['a']);
    expect(next.tally[1]).toBe(1);
    expect(next.tally.reduce((sum, count) => sum + count, 0)).toBe(1);
  });

  it('never records which option a player chose — attribution is nowhere in the state', () => {
    // Two players vote differently. The state must be able to say two votes are
    // in and where they fell, and must *not* be able to say who cast which.
    const one = votingGameLogic.reduce(started(['a', 'b', 'c']), vote('a', 0, 0));
    const two = votingGameLogic.reduce(one, vote('b', 0, 2));

    expect(two.voters).toEqual(['a', 'b']);
    expect(two.tally[0]).toBe(1);
    expect(two.tally[2]).toBe(1);
    // The whole shape, pinned: there is no field keyed by player that holds a
    // choice. If a later change adds one, this is the test that has to be
    // deliberately rewritten to allow it.
    expect(Object.keys(two).sort()).toEqual(
      ['phase', 'players', 'promptIndex', 'prompts', 'tally', 'voters'].sort(),
    );
  });

  it('refuses a second vote from the same player, unchanged', () => {
    const first = votingGameLogic.reduce(started(['a', 'b']), vote('a', 0, 0));
    const again = votingGameLogic.reduce(first, vote('a', 0, 1));

    // Same reference: the hub reads an identical state as "nothing happened".
    expect(again).toBe(first);
  });

  it('refuses a vote on a prompt the room has moved on from', () => {
    const state = started(['a', 'b']);

    expect(votingGameLogic.reduce(state, vote('a', 1, 0))).toBe(state);
  });

  it('refuses a vote for an option the prompt does not have', () => {
    const state = started(['a', 'b']);
    const options = state.prompts[0]?.options.length ?? 0;

    expect(votingGameLogic.reduce(state, vote('a', 0, options))).toBe(state);
    expect(votingGameLogic.reduce(state, vote('a', 0, -1))).toBe(state);
  });

  it('refuses a vote from a phone that is in the room but not the game', () => {
    const state = started(['a', 'b']);

    expect(votingGameLogic.reduce(state, vote('late', 0, 0))).toBe(state);
  });

  it('reveals the prompt once everyone still present has voted', () => {
    const one = votingGameLogic.reduce(started(['a', 'b']), vote('a', 0, 0));

    expect(one.phase).toBe('voting');

    const two = votingGameLogic.reduce(one, vote('b', 0, 1));

    expect(two.phase).toBe('reveal');
  });

  it('does not wait for a player the room has stopped hearing from', () => {
    // b is away, so the room is not made to wait for them: a's vote is the last
    // one it can hear, and the prompt reveals.
    const next = votingGameLogic.reduce(started(['a', 'b']), {
      ...vote('a', 0, 0),
      awayPlayerIds: ['b'],
    });

    expect(next.phase).toBe('reveal');
  });
});

describe('advancing the room', () => {
  const advance = (promptIndex: number, phase: VotingState['phase']): VotingEvent => ({
    kind: 'advance',
    promptIndex,
    phase,
  });

  it('ends an open prompt at its Vote Timer, counting whoever voted', () => {
    const one = votingGameLogic.reduce(started(['a', 'b']), vote('a', 0, 0));
    const revealed = votingGameLogic.reduce(one, advance(0, 'voting'));

    expect(revealed.phase).toBe('reveal');
    // The vote that was in stands; the one that never came is simply not tallied.
    expect(revealed.tally[0]).toBe(1);
  });

  it('opens the next prompt with a fresh tally once a reveal ends', () => {
    const revealed = votingGameLogic.reduce(started(['a', 'b'], 3), advance(0, 'voting'));
    const next = votingGameLogic.reduce(revealed, advance(0, 'reveal'));

    expect(next.phase).toBe('voting');
    expect(next.promptIndex).toBe(1);
    expect(next.voters).toEqual([]);
    expect(next.tally).toEqual(next.prompts[1]?.options.map(() => 0));
  });

  it('finishes the game when the last reveal ends', () => {
    let state = started(['a', 'b'], 3);

    // Walk the whole game on the clock alone: vote-timer, reveal-timer, ×3.
    for (let index = 0; index < 3; index += 1) {
      state = votingGameLogic.reduce(state, advance(index, 'voting'));
      state = votingGameLogic.reduce(state, advance(index, 'reveal'));
    }

    expect(state.phase).toBe('finished');
  });

  it('ignores an advance addressed to a beat the room has already left', () => {
    const state = started(['a', 'b']);

    // The prompt is on beat 0:voting; a stray advance for its reveal is inert.
    expect(votingGameLogic.reduce(state, advance(0, 'reveal'))).toBe(state);
    expect(votingGameLogic.reduce(state, advance(1, 'voting'))).toBe(state);
  });

  it('has nothing left to do once finished', () => {
    let state = started(['a', 'b'], 3);

    for (let index = 0; index < 3; index += 1) {
      state = votingGameLogic.reduce(state, advance(index, 'voting'));
      state = votingGameLogic.reduce(state, advance(index, 'reveal'));
    }

    expect(votingGameLogic.reduce(state, advance(2, 'reveal'))).toBe(state);
  });
});

describe('the room clock', () => {
  it('runs the Vote Timer while a prompt is open', () => {
    const state = started(['a', 'b']);
    const deadline = votingGameLogic.deadline?.(state);

    expect(deadline?.beat).toBe('0:voting');
    expect(deadline?.afterMs).toBe(VOTE_SECONDS * 1000);
    expect(deadline?.event).toMatchObject({ kind: 'advance', promptIndex: 0, phase: 'voting' });
  });

  it('runs the Reveal Timer while the tally is up', () => {
    const revealed = votingGameLogic.reduce(started(['a', 'b']), {
      kind: 'advance',
      promptIndex: 0,
      phase: 'voting',
    });
    const deadline = votingGameLogic.deadline?.(revealed);

    expect(deadline?.beat).toBe('0:reveal');
    expect(deadline?.afterMs).toBe(REVEAL_SECONDS * 1000);
    expect(deadline?.event).toMatchObject({ kind: 'advance', promptIndex: 0, phase: 'reveal' });
  });

  it('names no player on either clock — the room raises them', () => {
    const state = started(['a', 'b']);

    expect(votingGameLogic.deadline?.(state)?.event.playerId).toBeUndefined();
  });

  it('stops once the game is finished', () => {
    let state = started(['a', 'b'], 3);

    for (let index = 0; index < 3; index += 1) {
      state = votingGameLogic.reduce(state, { kind: 'advance', promptIndex: index, phase: 'voting' });
      state = votingGameLogic.reduce(state, { kind: 'advance', promptIndex: index, phase: 'reveal' });
    }

    expect(votingGameLogic.deadline?.(state)).toBeUndefined();
  });
});
