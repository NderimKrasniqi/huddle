import type { GamePlayer } from '@huddle/game-core';
import { describe, expect, it } from 'vitest';

import { VOTE_SECONDS, votingGameLogic, type VotingState } from './logic';
import { watchedVoteScreen } from './voting-tv';

/**
 * The television is a pure function of the room's state and its roster, so it is
 * tested as one. What matters most is what it does *not* show: while a prompt is
 * open it reveals how many have voted and never the running tally, so the room
 * is not nudged by a leaderboard forming mid-vote.
 */

function player(id: string, away = false): GamePlayer {
  return { playerId: id, nickname: id.toUpperCase(), away };
}

function started(playerIds: string[]): VotingState {
  return votingGameLogic.createInitialState({
    players: playerIds.map((id) => player(id)),
    settings: { rounds: '3' },
  });
}

const roster = (ids: string[], away: string[] = []): GamePlayer[] =>
  ids.map((id) => player(id, away.includes(id)));

describe('the television while a prompt is open', () => {
  it('shows the prompt, its options, and how many have voted — not the tally', () => {
    const voted = votingGameLogic.reduce(started(['a', 'b', 'c']), {
      kind: 'vote',
      playerId: 'a',
      promptIndex: 0,
      optionIndex: 0,
    });
    const screen = watchedVoteScreen(voted, roster(['a', 'b', 'c']));

    expect(screen.kind).toBe('voting');
    if (screen.kind !== 'voting') return;

    expect(screen.promptNumber).toBe(1);
    expect(screen.promptCount).toBe(3);
    expect(screen.voted).toBe(1);
    expect(screen.playerCount).toBe(3);
    expect(screen.countdownSeconds).toBe(VOTE_SECONDS);
    // The options carry no count while the prompt is open — the shape has no
    // room for one, so a mid-vote leaderboard cannot be drawn.
    expect(screen.options.map((option) => Object.keys(option).sort())).toEqual(
      screen.options.map(() => ['optionIndex', 'text']),
    );
  });

  it('counts only the players the room is still hearing from', () => {
    const screen = watchedVoteScreen(started(['a', 'b', 'c']), roster(['a', 'b', 'c'], ['c']));

    expect(screen.kind).toBe('voting');
    if (screen.kind !== 'voting') return;

    // c is away and has not voted, so the room is not waiting on them: two.
    expect(screen.playerCount).toBe(2);
  });
});

describe('the television at the reveal', () => {
  function revealWith(votes: [string, number][], players: string[]): VotingState {
    let state = started(players);

    for (const [playerId, optionIndex] of votes) {
      state = votingGameLogic.reduce(state, { kind: 'vote', playerId, promptIndex: 0, optionIndex });
    }

    return state.phase === 'reveal'
      ? state
      : votingGameLogic.reduce(state, { kind: 'advance', promptIndex: 0, phase: 'voting' });
  }

  it('shows every option’s count and marks the leader', () => {
    const state = revealWith(
      [
        ['a', 0],
        ['b', 0],
        ['c', 1],
      ],
      ['a', 'b', 'c'],
    );
    const screen = watchedVoteScreen(state, roster(['a', 'b', 'c']));

    expect(screen.kind).toBe('reveal');
    if (screen.kind !== 'reveal') return;

    expect(screen.rows[0]).toMatchObject({ count: 2, leading: true });
    expect(screen.rows[1]).toMatchObject({ count: 1, leading: false });
  });

  it('marks every option on a tie', () => {
    const state = revealWith(
      [
        ['a', 0],
        ['b', 1],
      ],
      ['a', 'b'],
    );
    const screen = watchedVoteScreen(state, roster(['a', 'b']));

    expect(screen.kind).toBe('reveal');
    if (screen.kind !== 'reveal') return;

    expect(screen.rows[0]?.leading).toBe(true);
    expect(screen.rows[1]?.leading).toBe(true);
  });

  it('marks no leader when a prompt timed out with no votes', () => {
    // Nobody votes; the Vote Timer ends the prompt on an empty tally.
    const state = votingGameLogic.reduce(started(['a', 'b']), {
      kind: 'advance',
      promptIndex: 0,
      phase: 'voting',
    });
    const screen = watchedVoteScreen(state, roster(['a', 'b']));

    expect(screen.kind).toBe('reveal');
    if (screen.kind !== 'reveal') return;

    expect(screen.rows.every((row) => row.leading === false)).toBe(true);
    expect(screen.rows.every((row) => row.count === 0)).toBe(true);
  });
});

describe('the television when the game is over', () => {
  it('draws the closing screen', () => {
    let state = started(['a', 'b']);

    for (let index = 0; index < state.prompts.length; index += 1) {
      state = votingGameLogic.reduce(state, { kind: 'advance', promptIndex: index, phase: 'voting' });
      state = votingGameLogic.reduce(state, { kind: 'advance', promptIndex: index, phase: 'reveal' });
    }

    const screen = watchedVoteScreen(state, roster(['a', 'b']));

    expect(screen.kind).toBe('finished');
    if (screen.kind !== 'finished') return;

    expect(screen.promptCount).toBe(3);
  });
});
