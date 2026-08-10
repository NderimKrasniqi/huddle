import type { GamePlayer } from '@huddle/game-core';
import { describe, expect, it } from 'vitest';

import { answerScreen, type AnswerScreen } from './answering';
import { triviaGameLogic, type TriviaState } from './logic';

/**
 * What the Answer Screen offers the thumb holding the phone.
 *
 * The rules are the reducer's and are not re-litigated here (`logic.test.ts`):
 * this is the other half of the same promises — that the screen never offers a
 * tap the rules would refuse. So every state below is reached by running the
 * real reducer rather than by writing a state out, because a screen tested
 * against states the game cannot produce is a screen tested against nothing.
 */

const ADA = 'p1';
const GRACE = 'p2';

function player(playerId: string): GamePlayer {
  return { playerId, nickname: playerId, away: false, avatar: 'fox' };
}

function gameWith(...playerIds: readonly string[]): TriviaState {
  return triviaGameLogic.createInitialState({
    players: playerIds.map(player),
    // A Host who chose nothing, which trivia reads as its schema's defaults.
    settings: {},
  });
}

function answering(state: TriviaState, playerId: string, optionIndex: number): TriviaState {
  return triviaGameLogic.reduce(state, {
    kind: 'answer',
    playerId,
    questionIndex: state.questionIndex,
    optionIndex,
  });
}

/** The room clock moving on from the beat on screen. */
function advancing(state: TriviaState): TriviaState {
  return triviaGameLogic.reduce(state, {
    kind: 'advance',
    questionIndex: state.questionIndex,
    phase: state.phase,
  });
}

/** The screen as the question branch, or a failure if it is not on one. */
function questionOn(screen: AnswerScreen): Extract<AnswerScreen, { kind: 'question' }> {
  if (screen.kind !== 'question') {
    throw new Error(`the screen is on ${screen.kind}, not a question`);
  }

  return screen;
}

describe('the four buttons a question puts up', () => {
  it('is one per option, in the question’s own order', () => {
    const state = gameWith(ADA, GRACE);
    const screen = questionOn(answerScreen(state, ADA));
    const question = state.questions[0];

    expect(screen.text).toBe(question?.text);
    expect(screen.options.map((option) => option.text)).toEqual(question?.options);
    expect(screen.options.map((option) => option.optionIndex)).toEqual([0, 1, 2, 3]);
  });

  it('is addressed to the question on screen, not to “now”', () => {
    // What the buttons send is aimed at the question this phone is looking at
    // (see `TriviaEvent`), so the screen has to carry it: a tap that leaves
    // while question one is up must answer question one or nothing at all.
    const second = advancing(advancing(gameWith(ADA, GRACE)));

    expect(questionOn(answerScreen(second, ADA)).questionIndex).toBe(1);
    expect(second.questionIndex).toBe(1);
  });

  it('is open on every option until this player answers', () => {
    const screen = questionOn(answerScreen(gameWith(ADA, GRACE), ADA));

    expect(screen.lockedIn).toBe(false);
    expect(screen.options.map((option) => option.state)).toEqual(['open', 'open', 'open', 'open']);
  });
});

describe('a player who has locked an answer in', () => {
  it('is shown as locked in, on the option they chose', () => {
    const state = answering(gameWith(ADA, GRACE), ADA, 2);
    const screen = questionOn(answerScreen(state, ADA));

    expect(screen.lockedIn).toBe(true);
    expect(screen.options.map((option) => option.state)).toEqual([
      'closed',
      'closed',
      'lockedIn',
      'closed',
    ]);
  });

  it('has no option left to press, which is what makes a second tap nothing', () => {
    const state = answering(gameWith(ADA, GRACE), ADA, 0);
    const screen = questionOn(answerScreen(state, ADA));

    // The reducer refuses a second answer either way; the screen's job is to
    // make it impossible to attempt.
    expect(screen.options.some((option) => option.state === 'open')).toBe(false);
  });

  it('leaves everybody else’s buttons open', () => {
    const state = answering(gameWith(ADA, GRACE), ADA, 0);
    const screen = questionOn(answerScreen(state, GRACE));

    expect(screen.lockedIn).toBe(false);
    expect(screen.options.every((option) => option.state === 'open')).toBe(true);
  });

  it('gets its four buttons back on the next question', () => {
    // The second answer is the last one, so the question reveals itself; one
    // "move on" from there is the next question.
    const answered = answering(gameWith(ADA, GRACE), ADA, 0);
    const next = advancing(answering(answered, GRACE, 1));
    const screen = questionOn(answerScreen(next, ADA));

    expect(screen.questionIndex).toBe(1);
    expect(screen.lockedIn).toBe(false);
    expect(screen.options.every((option) => option.state === 'open')).toBe(true);
  });
});

describe('a phone with no question to answer', () => {
  it('offers nothing during the reveal', () => {
    // "Answering before the question is shown is impossible" from the other
    // end: between two questions there is no button on this screen at all.
    const revealed = advancing(gameWith(ADA, GRACE));

    expect(revealed.phase).toBe('reveal');
    expect(answerScreen(revealed, ADA).kind).toBe('eyesUp');
  });

  it('offers nothing once the game is over', () => {
    let state = gameWith(ADA, GRACE);

    while (state.phase !== 'finished') {
      state = advancing(state);
    }

    expect(answerScreen(state, ADA).kind).toBe('eyesUp');
  });

  it('offers nothing to somebody who is not playing', () => {
    // A phone that joined after the game started is on the room's roster but
    // not in the Standings, and the reducer refuses its answers. Drawing four
    // live buttons for it would be offering a tap that does nothing.
    expect(answerScreen(gameWith(ADA), GRACE).kind).toBe('eyesUp');
  });

  it('sends the room’s eyes to the television, whichever of those it is', () => {
    const states = [
      advancing(gameWith(ADA, GRACE)),
      { ...gameWith(ADA, GRACE), questionIndex: 99 },
    ];

    for (const state of states) {
      const screen = answerScreen(state, ADA);

      expect(screen.kind).toBe('eyesUp');
      expect(screen.kind === 'eyesUp' && screen.line).toMatch(/TV/);
    }
  });
});
