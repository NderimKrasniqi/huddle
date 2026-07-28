import type { GamePlayer } from '@huddle/game-core';
import { describe, expect, it } from 'vitest';

import { triviaGameLogic, type TriviaState } from './logic';
import { INLINE_QUESTIONS } from './questions';

/**
 * Trivia's rules, which are the only place in Huddle that knows what winning
 * is. Every test here runs the reducer the Convex mutation runs, on the
 * questions a real game is dealt — the reducer is pure, so this is the whole
 * game and not a model of it.
 */

const ADA = 'p1';
const GRACE = 'p2';

function player(playerId: string): GamePlayer {
  return { playerId, nickname: playerId, away: false };
}

/** A game just started, with the players named, in that roster order. */
function gameWith(...playerIds: readonly string[]): TriviaState {
  return triviaGameLogic.createInitialState({
    players: playerIds.map(player),
    settings: undefined,
  });
}

/** The question on screen — the one every event below is aimed at. */
function questionOf(state: TriviaState) {
  const question = state.questions[state.questionIndex];

  if (question === undefined) {
    throw new Error(`no question at index ${state.questionIndex}`);
  }

  return question;
}

function rightAnswerTo(state: TriviaState): number {
  return questionOf(state).correctIndex;
}

function wrongAnswerTo(state: TriviaState): number {
  return (rightAnswerTo(state) + 1) % questionOf(state).options.length;
}

function answering(state: TriviaState, playerId: string, optionIndex: number): TriviaState {
  return triviaGameLogic.reduce(state, {
    kind: 'answer',
    playerId,
    questionIndex: state.questionIndex,
    optionIndex,
  });
}

/** The room moving on: the reveal ending, or a question nobody answered. */
function advancing(state: TriviaState, playerId: string = ADA): TriviaState {
  return triviaGameLogic.reduce(state, advanceOf(state, playerId));
}

/** The "move on" a phone looking at this state would send. */
function advanceOf(state: TriviaState, playerId: string = ADA) {
  return {
    kind: 'advance',
    playerId,
    questionIndex: state.questionIndex,
    phase: state.phase,
  } as const;
}

function scoreOf(state: TriviaState, playerId: string): number | undefined {
  return state.standings.find((standing) => standing.playerId === playerId)?.score;
}

describe('the questions trivia is dealt', () => {
  it('is three questions long, which is the whole game until packs land', () => {
    // Phase 4 replaces these with a curated Question Pack. Until then they are
    // trivia's entire content, and three is what a playthrough test can walk.
    expect(INLINE_QUESTIONS).toHaveLength(3);
  });

  it('asks four options with exactly one right answer', () => {
    for (const question of INLINE_QUESTIONS) {
      expect(question.text).not.toBe('');
      expect(question.options).toHaveLength(4);
      // Four *distinct* options: two identical ones would be a second right
      // answer whenever one of them was the correct index.
      expect(new Set(question.options).size).toBe(4);
      expect(question.options[question.correctIndex]).toBeDefined();
    }
  });
});

describe('a game of trivia', () => {
  it('opens on the first question with everybody on nothing', () => {
    const state = gameWith(ADA, GRACE);

    expect(state.phase).toBe('question');
    expect(state.questionIndex).toBe(0);
    expect(state.answers).toEqual({});
    // Roster order, because nobody has scored yet and the sort is stable.
    expect(state.standings).toEqual([
      { playerId: ADA, score: 0 },
      { playerId: GRACE, score: 0 },
    ]);
  });

  it('waits for every player before it reveals', () => {
    const asked = gameWith(ADA, GRACE);
    const state = answering(asked, ADA, rightAnswerTo(asked));

    expect(state.phase).toBe('question');
    expect(state.answers).toEqual({ [ADA]: rightAnswerTo(asked) });
    // Nothing is scored while a question is still on screen: the reveal is
    // where a score changes, so it is where the points are added.
    expect(scoreOf(state, ADA)).toBe(0);
  });

  it('scores a correct answer 100 and a wrong one nothing', () => {
    const asked = gameWith(ADA, GRACE);
    const revealed = answering(
      answering(asked, ADA, rightAnswerTo(asked)),
      GRACE,
      wrongAnswerTo(asked),
    );

    expect(revealed.phase).toBe('reveal');
    expect(scoreOf(revealed, ADA)).toBe(100);
    expect(scoreOf(revealed, GRACE)).toBe(0);
  });

  it('scores a player who never answered nothing', () => {
    const asked = gameWith(ADA, GRACE);
    const revealed = advancing(answering(asked, ADA, rightAnswerTo(asked)));

    expect(revealed.phase).toBe('reveal');
    expect(scoreOf(revealed, ADA)).toBe(100);
    expect(scoreOf(revealed, GRACE)).toBe(0);
  });

  it('takes a player’s first answer and ignores the rest', () => {
    const asked = gameWith(ADA, GRACE);
    const locked = answering(asked, ADA, wrongAnswerTo(asked));
    const changedMind = answering(locked, ADA, rightAnswerTo(asked));

    expect(changedMind).toBe(locked);
    expect(scoreOf(advancing(changedMind), ADA)).toBe(0);
  });

  it('ignores an answer to a question that is no longer on screen', () => {
    const asked = gameWith(ADA, GRACE);
    const second = advancing(advancing(asked));

    // A tap that left the phone while question one was up, and landed after
    // the room had moved on. It answers the question it was aimed at, or
    // nothing at all — never whatever happens to be on screen when it lands.
    const late = triviaGameLogic.reduce(second, {
      kind: 'answer',
      playerId: ADA,
      questionIndex: asked.questionIndex,
      optionIndex: rightAnswerTo(second),
    });

    expect(late).toBe(second);
  });

  it('ignores an answer from someone who is not in the game', () => {
    const asked = gameWith(ADA, GRACE);

    expect(answering(asked, 'p9', rightAnswerTo(asked))).toBe(asked);
  });

  it('ignores an option the question does not have', () => {
    const asked = gameWith(ADA, GRACE);

    expect(answering(asked, ADA, 4)).toBe(asked);
    expect(answering(asked, ADA, -1)).toBe(asked);
  });

  it('cannot be answered while the reveal is up', () => {
    const asked = gameWith(ADA, GRACE);
    const revealed = advancing(asked);

    expect(answering(revealed, ADA, rightAnswerTo(asked))).toBe(revealed);
    expect(scoreOf(revealed, ADA)).toBe(0);
  });

  it('moves to the next question when the reveal ends', () => {
    const asked = gameWith(ADA, GRACE);
    const next = advancing(advancing(asked));

    expect(next.phase).toBe('question');
    expect(next.questionIndex).toBe(1);
    expect(next.answers).toEqual({});
  });

  it('ignores a second “move on” for a beat the room has left', () => {
    const revealed = advancing(gameWith(ADA, GRACE));
    const endReveal = advanceOf(revealed, ADA);

    // Two thumbs a beat apart — the ordinary case, since `advance` is the
    // room's only "move on" signal and every source of it races every other.
    const second = triviaGameLogic.reduce(triviaGameLogic.reduce(revealed, endReveal), endReveal);

    // The duplicate must not end the question it landed on: revealing question
    // two here would score the room nothing on a question it never read, and
    // the next "move on" would take the game past it entirely.
    expect(second.phase).toBe('question');
    expect(second.questionIndex).toBe(1);
  });

  it('ignores a “move on” for a question the last answer already ended', () => {
    const asked = gameWith(ADA, GRACE);
    // Sent while the question was still up — a Host skipping ahead, or Phase
    // 4's countdown expiring — and landing just after the last player's answer
    // had revealed it. Same question, a beat later.
    const skip = advanceOf(asked, ADA);
    const revealed = answering(
      answering(asked, ADA, rightAnswerTo(asked)),
      GRACE,
      wrongAnswerTo(asked),
    );

    expect(revealed.phase).toBe('reveal');
    // Acting on it would cut the reveal off mid-read: nobody would see the
    // right answer to this question, or the running scoreboard after it.
    expect(triviaGameLogic.reduce(revealed, skip)).toBe(revealed);
  });

  it('ignores a “move on” aimed at an earlier question', () => {
    const asked = gameWith(ADA, GRACE);
    const stale = advanceOf(asked, ADA);
    const second = advancing(advancing(asked));

    expect(triviaGameLogic.reduce(second, stale)).toBe(second);
  });

  it('never mutates the state it was handed', () => {
    const asked = gameWith(ADA, GRACE);
    const before = structuredClone(asked);

    advancing(answering(asked, ADA, rightAnswerTo(asked)));

    expect(asked).toEqual(before);
  });
});

describe('a game played to the end', () => {
  /**
   * The plan's own scenario: A answers all three correctly, B gets the first
   * one and then misses one and sits out the last.
   */
  function playthrough(): TriviaState {
    let state = gameWith(ADA, GRACE);

    // Question one: both right.
    state = answering(state, ADA, rightAnswerTo(state));
    state = answering(state, GRACE, rightAnswerTo(state));
    state = advancing(state);

    // Question two: A right, B wrong.
    state = answering(state, ADA, rightAnswerTo(state));
    state = answering(state, GRACE, wrongAnswerTo(state));
    state = advancing(state);

    // Question three: A right, B never answers, so the room moves on without
    // them.
    state = answering(state, ADA, rightAnswerTo(state));
    state = advancing(state);

    return state;
  }

  it('leaves A on 300 for 3/3 and B on 100 for 1/3', () => {
    const finished = advancing(playthrough());

    expect(scoreOf(finished, ADA)).toBe(300);
    expect(scoreOf(finished, GRACE)).toBe(100);
  });

  it('finishes after the last reveal, standings in order', () => {
    const lastReveal = playthrough();

    // The last reveal is still a reveal: the room sees the answer and the
    // running scoreboard before the game is over.
    expect(lastReveal.phase).toBe('reveal');

    const finished = advancing(lastReveal);

    expect(finished.phase).toBe('finished');
    expect(finished.standings).toEqual([
      { playerId: ADA, score: 300 },
      { playerId: GRACE, score: 100 },
    ]);
  });

  it('stays finished', () => {
    const finished = advancing(playthrough());

    expect(advancing(finished)).toBe(finished);
    expect(answering(finished, ADA, 0)).toBe(finished);
  });
});
