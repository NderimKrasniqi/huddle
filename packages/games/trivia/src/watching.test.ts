import type { GamePlayer } from '@huddle/game-core';
import { describe, expect, it } from 'vitest';

import { triviaGameLogic, type TriviaState } from './logic';
import { watchedScreen, type WatchedScreen } from './watching';

/**
 * What the television says about a game of trivia.
 *
 * Every state below is reached by running the real reducer, for the reason
 * `answering.test.ts` gives: a screen tested against states the game cannot
 * produce is a screen tested against nothing.
 */

const ADA = 'p1';
const GRACE = 'p2';

function player(playerId: string, nickname: string): GamePlayer {
  return { playerId, nickname, away: false };
}

const ROSTER = [player(ADA, 'Ada'), player(GRACE, 'Grace')];

function gameWith(...players: readonly GamePlayer[]): TriviaState {
  return triviaGameLogic.createInitialState({ players, settings: undefined });
}

function answering(state: TriviaState, playerId: string, optionIndex: number): TriviaState {
  return triviaGameLogic.reduce(state, {
    kind: 'answer',
    playerId,
    questionIndex: state.questionIndex,
    optionIndex,
  });
}

/** The correct option for whichever question is up. */
function correctOption(state: TriviaState): number {
  const question = state.questions[state.questionIndex];

  if (question === undefined) {
    throw new Error('the game has run out of questions');
  }

  return question.correctIndex;
}

/** Both players answer, which ends the question and puts the reveal up. */
function playedOut(state: TriviaState, adaOption: number, graceOption: number): TriviaState {
  return answering(answering(state, ADA, adaOption), GRACE, graceOption);
}

function screenOf(state: TriviaState): WatchedScreen {
  return watchedScreen(state, ROSTER);
}

describe('a question on the television', () => {
  it('shows the question, its four options, and where the room is in the set', () => {
    const screen = screenOf(gameWith(...ROSTER));

    expect(screen.kind).toBe('question');

    if (screen.kind !== 'question') {
      return;
    }

    expect(screen.options).toHaveLength(4);
    expect(screen.questionNumber).toBe(1);
    expect(screen.questionCount).toBe(3);
    expect(screen.text).not.toBe('');
  });

  it('does not give the answer away before the reveal', () => {
    const screen = screenOf(gameWith(...ROSTER));

    if (screen.kind !== 'question') {
      throw new Error('expected a question');
    }

    // Not "every option is marked wrong" — the television does not know yet,
    // and a `false` on the screen would be it claiming that it does.
    expect(screen.options.every((option) => option.correct === undefined)).toBe(true);
  });

  it('counts how many have answered, out of how many are playing', () => {
    const asked = gameWith(...ROSTER);
    const opening = screenOf(asked);
    const oneIn = screenOf(answering(asked, ADA, 0));

    if (opening.kind !== 'question' || oneIn.kind !== 'question') {
      throw new Error('expected questions');
    }

    expect([opening.answered, opening.playerCount]).toEqual([0, 2]);
    expect([oneIn.answered, oneIn.playerCount]).toEqual([1, 2]);
  });
});

describe('the reveal on the television', () => {
  it('marks exactly the correct option, and no other', () => {
    const asked = gameWith(...ROSTER);
    const screen = screenOf(playedOut(asked, 0, 1));

    if (screen.kind !== 'reveal') {
      throw new Error('expected a reveal');
    }

    expect(screen.options.filter((option) => option.correct === true)).toHaveLength(1);
    expect(screen.options.find((option) => option.correct === true)?.optionIndex).toBe(
      correctOption(asked),
    );
  });

  it('says who got it right and who did not', () => {
    const asked = gameWith(...ROSTER);
    const right = correctOption(asked);
    const screen = screenOf(playedOut(asked, right, (right + 1) % 4));

    if (screen.kind !== 'reveal') {
      throw new Error('expected a reveal');
    }

    expect(screen.verdicts).toEqual([
      expect.objectContaining({ nickname: 'Ada', correct: true }),
      expect.objectContaining({ nickname: 'Grace', correct: false }),
    ]);
  });

  it('counts a player who never answered as wrong, not as missing', () => {
    const asked = gameWith(...ROSTER);
    const right = correctOption(asked);
    // Only Ada answers; the room moves on without waiting for Grace.
    const revealed = triviaGameLogic.reduce(answering(asked, ADA, right), {
      kind: 'advance',
      playerId: ADA,
      questionIndex: 0,
      phase: 'question',
    });
    const screen = screenOf(revealed);

    if (screen.kind !== 'reveal') {
      throw new Error('expected a reveal');
    }

    expect(screen.verdicts).toHaveLength(2);
    expect(screen.verdicts.find((verdict) => verdict.nickname === 'Grace')?.correct).toBe(false);
  });

  it('carries the running scoreboard in the standings’ own order', () => {
    const asked = gameWith(...ROSTER);
    const right = correctOption(asked);
    const screen = screenOf(playedOut(asked, (right + 1) % 4, right));

    if (screen.kind !== 'reveal') {
      throw new Error('expected a reveal');
    }

    // Grace answered correctly, so she leads — and the scoreboard is the
    // standings, not a re-sort of them.
    expect(screen.scoreboard.map((row) => [row.nickname, row.score])).toEqual([
      ['Grace', 100],
      ['Ada', 0],
    ]);
  });
});

describe('a television with no question up', () => {
  it('shows the final scoreboard once the game is over', () => {
    let state = gameWith(...ROSTER);
    const advanceOf = (from: TriviaState): TriviaState =>
      triviaGameLogic.reduce(from, {
        kind: 'advance',
        playerId: ADA,
        questionIndex: from.questionIndex,
        phase: from.phase,
      });

    // Play the set out: answer, reveal, move on, three times over. Grace's
    // answer is derived from the right one rather than fixed, or she would
    // stumble into scoring on whichever question happens to answer to it.
    for (let question = 0; question < 3; question += 1) {
      const right = correctOption(state);
      state = playedOut(state, right, (right + 1) % 4);
      state = advanceOf(state);
    }

    const screen = screenOf(state);

    expect(screen.kind).toBe('finished');

    if (screen.kind !== 'finished') {
      return;
    }

    expect(screen.scoreboard.map((row) => [row.nickname, row.score])).toEqual([
      ['Ada', 300],
      ['Grace', 0],
    ]);
  });

  it('still names a player the roster has lost, rather than drawing a blank seat', () => {
    const asked = gameWith(...ROSTER);
    // Grace's phone is gone from the roster, but the game she played is not
    // rewritten by her leaving.
    const screen = watchedScreen(playedOut(asked, 0, 1), [player(ADA, 'Ada')]);

    if (screen.kind !== 'reveal') {
      throw new Error('expected a reveal');
    }

    expect(screen.scoreboard).toHaveLength(2);
    expect(screen.scoreboard.map((row) => row.nickname)).toEqual(['Ada', 'Player']);
  });
});
