import type { GamePlayer } from '@huddle/game-core';
import { describe, expect, it } from 'vitest';

import {
  FLAT_SCORE_PER_CORRECT_ANSWER,
  QUESTION_SECONDS,
  triviaGameLogic,
  type TriviaState,
} from './logic';
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
const LINUS = 'p3';

function player(playerId: string, nickname: string): GamePlayer {
  return { playerId, nickname, away: false, avatar: 'fox' };
}

/** The same player, with the room no longer hearing from their phone. */
function away(seated: GamePlayer): GamePlayer {
  return { ...seated, away: true };
}

const ROSTER = [player(ADA, 'Ada'), player(GRACE, 'Grace')];

function gameWith(...players: readonly GamePlayer[]): TriviaState {
  // A Host who chose nothing, which trivia reads as its schema's defaults.
  return triviaGameLogic.createInitialState({ players, settings: {} });
}

function answering(state: TriviaState, playerId: string, optionIndex: number): TriviaState {
  return triviaGameLogic.reduce(state, {
    kind: 'answer',
    playerId,
    questionIndex: state.questionIndex,
    optionIndex,
  });
}

/** Whichever question is up, or a failure if the game has run out of them. */
function questionUp(state: TriviaState) {
  const question = state.questions[state.questionIndex];

  if (question === undefined) {
    throw new Error('the game has run out of questions');
  }

  return question;
}

/** The correct option for whichever question is up. */
function correctOption(state: TriviaState): number {
  return questionUp(state).correctIndex;
}

/** Both players answer, which ends the question and puts the reveal up. */
function playedOut(state: TriviaState, adaOption: number, graceOption: number): TriviaState {
  return answering(answering(state, ADA, adaOption), GRACE, graceOption);
}

function screenOf(state: TriviaState): WatchedScreen {
  return watchedScreen(state, ROSTER);
}

/**
 * A whole game played out: everybody answers every question the way `answerOf`
 * says, and the reveal is ended each time.
 *
 * The answers are derived from whichever option is right rather than fixed, so
 * a player meant to be wrong cannot stumble into scoring on the one question
 * their fixed button happens to answer.
 *
 * Counted out by the questions rather than run until the game says it is
 * finished: a game that stopped ending its questions would spin here forever,
 * and a synchronous spin hangs the run instead of failing it — Vitest's timeout
 * cannot interrupt one. Bounded, the same bug is a red test.
 */
function playedToTheEnd(
  players: readonly GamePlayer[],
  answerOf: (player: GamePlayer, correct: number, optionCount: number) => number,
): TriviaState {
  let state = gameWith(...players);
  const questionCount = state.questions.length;

  for (let asked = 0; asked < questionCount && state.phase !== 'finished'; asked += 1) {
    const question = questionUp(state);

    // The last of these ends the question and puts the reveal up.
    for (const seated of players) {
      state = answering(
        state,
        seated.playerId,
        answerOf(seated, question.correctIndex, question.options.length),
      );
    }

    state = triviaGameLogic.reduce(state, {
      kind: 'advance',
      questionIndex: state.questionIndex,
      phase: 'reveal',
    });
  }

  if (state.phase !== 'finished') {
    throw new Error('the game did not finish within its own questions');
  }

  return state;
}

/**
 * Everyone answers correctly except the players named, who answer wrongly.
 *
 * The wrong answer is the next option round, counted against however many
 * options the question has: an index past the end is not a wrong answer but no
 * answer at all, since the reducer refuses it and the question never ends.
 */
function everyoneRightExcept(...wrong: readonly string[]) {
  return (seated: GamePlayer, correct: number, optionCount: number): number =>
    wrong.includes(seated.playerId) ? (correct + 1) % optionCount : correct;
}

describe('a question on the television', () => {
  it('shows the question, its four options, and where the room is in the set', () => {
    const state = gameWith(...ROSTER);
    const screen = screenOf(state);

    expect(screen.kind).toBe('question');

    if (screen.kind !== 'question') {
      return;
    }

    expect(screen.options).toHaveLength(4);
    expect(screen.questionNumber).toBe(1);
    // However many the room was dealt: the Host chooses the length of a game
    // now, so "1 of 10" is a fact about this game and not about trivia.
    expect(screen.questionCount).toBe(state.questions.length);
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

  it('counts nobody the room has stopped hearing from into the denominator', () => {
    const asked = gameWith(...ROSTER);
    // Grace's phone has gone quiet: the room is waiting for one player, and the
    // chip has to say so or it counts down to a number it never reaches.
    const screen = watchedScreen(asked, [player(ADA, 'Ada'), away(player(GRACE, 'Grace'))]);

    if (screen.kind !== 'question') {
      throw new Error('expected a question');
    }

    expect([screen.answered, screen.playerCount]).toEqual([0, 1]);
  });

  it('keeps an answer already in, from a phone that has gone quiet since', () => {
    const asked = gameWith(...ROSTER);
    const screen = watchedScreen(answering(asked, GRACE, 0), [
      player(ADA, 'Ada'),
      away(player(GRACE, 'Grace')),
    ]);

    if (screen.kind !== 'question') {
      throw new Error('expected a question');
    }

    // Grace is not being waited for, but she is in: a chip that dropped her
    // would be the television losing an answer the room already has.
    expect([screen.answered, screen.playerCount]).toEqual([1, 2]);
  });

  it('counts nobody at all in a room whose every phone has gone quiet', () => {
    const asked = gameWith(...ROSTER);
    const quiet = [away(player(ADA, 'Ada')), away(player(GRACE, 'Grace'))];
    const opening = watchedScreen(asked, quiet);
    // One of them wakes up and answers, which counts them back in — the room is
    // then waiting for exactly the player who has already answered, and the
    // reveal happens on that answer (see `logic.test.ts`).
    const oneBack = watchedScreen(answering(asked, ADA, 0), quiet);

    if (opening.kind !== 'question' || oneBack.kind !== 'question') {
      throw new Error('expected questions');
    }

    // Nobody in and nobody counted: the chip agrees with a room that is waiting
    // on its Question Timer rather than on anybody.
    expect([opening.answered, opening.playerCount]).toEqual([0, 0]);
    expect([oneBack.answered, oneBack.playerCount]).toEqual([1, 1]);
  });

  it('says how long the room has, so the countdown counts the rule’s seconds', () => {
    const screen = screenOf(gameWith(...ROSTER));

    if (screen.kind !== 'question') {
      throw new Error('expected a question');
    }

    // The same number the room's own clock runs on. A television counting down
    // from a number of its own would be a countdown that hit zero while the
    // question was still live, or held at zero while the room waited.
    expect(screen.countdownSeconds).toBe(QUESTION_SECONDS);
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

  it('marks the row of a player the room has stopped hearing from', () => {
    const asked = gameWith(...ROSTER);
    const screen = watchedScreen(playedOut(asked, 0, 1), [
      player(ADA, 'Ada'),
      away(player(GRACE, 'Grace')),
    ]);

    if (screen.kind !== 'reveal') {
      throw new Error('expected a reveal');
    }

    // The Status Dot the roster draws, on the surface the game lists players
    // on: presence is news wherever a player is drawn.
    expect(screen.scoreboard.map((row) => [row.nickname, row.away])).toEqual([
      ['Ada', false],
      ['Grace', true],
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

describe('the Victory Screen', () => {
  /** The finished screen, or a failure if the game is not over. */
  function victoryOf(
    state: TriviaState,
    players: readonly GamePlayer[],
  ): Extract<WatchedScreen, { kind: 'finished' }> {
    const screen = watchedScreen(state, players);

    if (screen.kind !== 'finished') {
      throw new Error('expected a finished game');
    }

    return screen;
  }

  it('places the final standings, highest first', () => {
    const played = playedToTheEnd(ROSTER, everyoneRightExcept(GRACE));
    const screen = victoryOf(played, ROSTER);
    // A clean sweep of whatever the room was dealt, since the Host chooses how
    // many questions a game runs.
    const everyQuestion = played.questions.length * FLAT_SCORE_PER_CORRECT_ANSWER;

    expect(screen.standings.map((row) => [row.nickname, row.score, row.rank])).toEqual([
      ['Ada', everyQuestion, 1],
      ['Grace', 0, 2],
    ]);
  });

  it('celebrates the winner by name', () => {
    const screen = victoryOf(playedToTheEnd(ROSTER, everyoneRightExcept(GRACE)), ROSTER);

    expect(screen.headline).toBe('Ada wins!');
    expect(screen.standings.filter((row) => row.winner).map((row) => row.nickname)).toEqual(['Ada']);
  });

  it('gives tied players the same top rank, and skips the rank they took between them', () => {
    const party = [player(ADA, 'Ada'), player(GRACE, 'Grace'), player(LINUS, 'Linus')];
    const screen = victoryOf(playedToTheEnd(party, everyoneRightExcept(LINUS)), party);

    // "Ties share the top rank": two winners are both first,
    // and the player behind them is third rather than second.
    expect(screen.standings.map((row) => [row.nickname, row.rank, row.winner])).toEqual([
      ['Ada', 1, true],
      ['Grace', 1, true],
      ['Linus', 3, false],
    ]);
  });

  it('says the game was tied rather than picking one of the players who tied', () => {
    const party = [player(ADA, 'Ada'), player(GRACE, 'Grace'), player(LINUS, 'Linus')];
    const screen = victoryOf(playedToTheEnd(party, everyoneRightExcept(LINUS)), party);

    expect(screen.headline).toBe('It’s a tie!');
  });

  it('ties a whole room that scored nothing, rather than crowning the first seat', () => {
    // Everybody wrong on every question is a real game, not a degenerate one —
    // and the standings are then all on 0, which is a ten-way tie for the win.
    const screen = victoryOf(playedToTheEnd(ROSTER, everyoneRightExcept(ADA, GRACE)), ROSTER);

    expect(screen.headline).toBe('It’s a tie!');
    expect(screen.standings.map((row) => [row.score, row.rank, row.winner])).toEqual([
      [0, 1, true],
      [0, 1, true],
    ]);
  });

  it('still names a player the roster has lost, rather than drawing a blank row', () => {
    const played = playedToTheEnd(ROSTER, everyoneRightExcept(GRACE));
    // Grace's phone is gone, but the game she played — and lost — is not
    // rewritten by her leaving.
    const screen = victoryOf(played, [player(ADA, 'Ada')]);

    expect(screen.standings.map((row) => row.nickname)).toEqual(['Ada', 'Player']);
  });
});
