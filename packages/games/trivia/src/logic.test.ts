import { type GamePlayer, type GameSettings, settingsFrom } from '@huddle/game-core';
import { CURATED_PACK } from '@huddle/packs';
import { describe, expect, it } from 'vitest';

import {
  QUESTION_SECONDS,
  questionTimer,
  REVEAL_SECONDS,
  revealBeat,
  triviaGameLogic,
  type TriviaState,
} from './logic';
import { EVERY_CATEGORY, PACK_CATEGORIES } from './questions';
import { TRIVIA_SETTINGS_SCHEMA } from './settings';

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

/**
 * A game just started, with the players named, in that roster order — on the
 * settings a Host who opened nothing starts one with.
 */
function gameWith(...playerIds: readonly string[]): TriviaState {
  return startedOn(undefined, ...playerIds);
}

/** A game started on the Host's choices, settled the way `startGame` settles them. */
function startedOn(chosen: GameSettings | undefined, ...playerIds: readonly string[]): TriviaState {
  return triviaGameLogic.createInitialState({
    players: playerIds.map(player),
    settings: settingsFrom(TRIVIA_SETTINGS_SCHEMA, chosen),
  });
}

/**
 * The same game cut to three questions, which is what a playthrough test can
 * walk end to end.
 *
 * Three is not a length the Host can choose (the schema offers 5, 10 and 20), so
 * it is cut here rather than started that way: the reducer takes a state and the
 * scenarios below are about its rules, not about how long a game is.
 */
function shortGameWith(...playerIds: readonly string[]): TriviaState {
  const full = gameWith(...playerIds);

  return { ...full, questions: full.questions.slice(0, 3) };
}

/** The category the pack puts a question in, which the rules do not carry. */
function categoryOf(question: { readonly text: string }): string | undefined {
  return CURATED_PACK.questions.find((asked) => asked.text === question.text)?.category;
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

describe('the questions a game is dealt', () => {
  it('comes from the Curated Pack', () => {
    for (const question of gameWith(ADA, GRACE).questions) {
      expect(categoryOf(question), question.text).toBeDefined();
    }
  });

  it('asks four options with exactly one right answer', () => {
    for (const question of gameWith(ADA, GRACE).questions) {
      expect(question.text).not.toBe('');
      expect(question.options).toHaveLength(4);
      // Four *distinct* options: two identical ones would be a second right
      // answer whenever one of them was the correct index.
      expect(new Set(question.options).size).toBe(4);
      expect(question.options[question.correctIndex]).toBeDefined();
    }
  });

  it('is ten questions long when the Host chose nothing', () => {
    expect(gameWith(ADA, GRACE).questions).toHaveLength(10);
  });

  it('is exactly as many questions as the Host chose', () => {
    expect(startedOn({ questionCount: '5' }, ADA, GRACE).questions).toHaveLength(5);
    expect(startedOn({ questionCount: '20' }, ADA, GRACE).questions).toHaveLength(20);
  });

  it('is only the category the Host chose', () => {
    const movies = startedOn({ category: 'Movies', questionCount: '20' }, ADA, GRACE);

    expect(movies.questions).toHaveLength(20);
    expect(movies.questions.map(categoryOf)).toEqual(Array(20).fill('Movies'));
  });

  it('can be filtered to any category the pack offers, and never comes up empty', () => {
    for (const category of PACK_CATEGORIES) {
      const filtered = startedOn({ category, questionCount: '5' }, ADA, GRACE);

      expect(filtered.questions.map(categoryOf), category).toEqual(Array(5).fill(category));
    }
  });

  it('spans the pack when the Host chose every category', () => {
    // The pack is written a category at a time, so taking the front of it would
    // deal a room that asked for everything twenty questions about films.
    const dealt = startedOn({ category: EVERY_CATEGORY, questionCount: '5' }, ADA, GRACE);

    expect(new Set(dealt.questions.map(categoryOf)).size).toBe(5);
  });

  it('never asks the same question twice in one game', () => {
    const dealt = startedOn({ questionCount: '20' }, ADA, GRACE);

    expect(new Set(dealt.questions.map((question) => question.text)).size).toBe(20);
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
    let state = shortGameWith(ADA, GRACE);

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

/**
 * The beat that ends a reveal.
 *
 * Tested here rather than through the screen that runs it because getting it
 * wrong is silent: an `advance` addressed to the wrong beat is inert by design,
 * so a mistake does not throw or fail a render — it hangs the reveal forever.
 * These are the assertions that turn that into a red test.
 */
describe('the beat that ends a reveal', () => {
  it('is nothing at all while a question is still up', () => {
    expect(revealBeat(gameWith(ADA, GRACE), ADA)).toBeUndefined();
  });

  it('is nothing once the game is over', () => {
    let finished = shortGameWith(ADA, GRACE);
    const questionsInIt = finished.questions.length;

    for (let question = 0; question < questionsInIt; question += 1) {
      finished = answering(finished, ADA, rightAnswerTo(finished));
      finished = answering(finished, GRACE, rightAnswerTo(finished));
      finished = advancing(finished);
    }

    expect(finished.phase).toBe('finished');
    expect(revealBeat(finished, ADA)).toBeUndefined();
  });

  it('is addressed to the reveal on screen, so the room actually moves on', () => {
    const revealed = answering(
      answering(gameWith(ADA, GRACE), ADA, 0),
      GRACE,
      0,
    );

    expect(revealed.phase).toBe('reveal');

    const beat = revealBeat(revealed, ADA);

    if (beat === undefined) {
      throw new Error('a reveal must have a beat that ends it');
    }

    expect(beat.afterMs).toBe(REVEAL_SECONDS * 1000);

    // The assertion that matters: the event this produces must be one the
    // reducer acts on. Addressed to any other beat it would be swallowed in
    // silence and the reveal would never end.
    const moved = triviaGameLogic.reduce(revealed, beat.event);

    expect(moved).not.toBe(revealed);
    expect(moved.phase).toBe('question');
    expect(moved.questionIndex).toBe(revealed.questionIndex + 1);
  });

  it('is inert when it fires late, which is what lets every phone send it', () => {
    const revealed = answering(answering(gameWith(ADA, GRACE), ADA, 0), GRACE, 0);
    const beat = revealBeat(revealed, ADA);
    const movedOn = advancing(revealed);

    if (beat === undefined) {
      throw new Error('a reveal must have a beat that ends it');
    }

    // Ada's phone was slow; by the time it fires the room is on the next
    // question. The nine other phones that sent the same thing are why the
    // room did not wait for her.
    expect(triviaGameLogic.reduce(movedOn, beat.event)).toBe(movedOn);
  });
});

/**
 * The Question Timer: the twenty seconds a question stays up, and the `advance`
 * that ends it.
 *
 * Tested here for the reason the reveal's beat is — a mis-addressed deadline is
 * inert by design, so getting it wrong throws nothing and hangs the question
 * forever — and for one more that is its own. This clock is the *room's* and
 * not a phone's: the hub schedules it server-side, so nobody is looking at the
 * screen it runs on, and a question that never ended would be ten phones
 * showing four dead buttons with no way to say so.
 */
describe('the clock a question runs on', () => {
  /** The timer a room on this state would have running, or a failure. */
  function timerOn(state: TriviaState) {
    const timer = questionTimer(state);

    if (timer === undefined) {
      throw new Error('a question on screen must have a clock running on it');
    }

    return timer;
  }

  it('gives the room the plan’s twenty seconds', () => {
    expect(QUESTION_SECONDS).toBe(20);
    expect(timerOn(gameWith(ADA, GRACE)).afterMs).toBe(QUESTION_SECONDS * 1000);
  });

  it('comes from the room rather than from any player', () => {
    // Nobody sent it: it is the clock running out, which is exactly what an
    // absent `playerId` says (`GameEvent`). A trivia event that named a player
    // here would be the room impersonating whoever it happened to pick.
    expect(timerOn(gameWith(ADA, GRACE)).event.playerId).toBeUndefined();
  });

  it('is addressed to the question on screen, so the room actually moves on', () => {
    const asked = gameWith(ADA, GRACE);
    const answered = answering(asked, ADA, rightAnswerTo(asked));
    const expired = triviaGameLogic.reduce(answered, timerOn(asked).event);

    expect(expired.phase).toBe('reveal');
    // The whole of what expiry costs: whoever did not answer scores what a
    // wrong answer scores.
    expect(scoreOf(expired, ADA)).toBe(100);
    expect(scoreOf(expired, GRACE)).toBe(0);
  });

  it('names one beat per question, however many answers land while it runs', () => {
    const asked = gameWith(ADA, GRACE);
    const halfAnswered = answering(asked, ADA, rightAnswerTo(asked));

    // What the hub compares to decide whether to arm a clock. Same beat means
    // the twenty seconds are already running: a question that started them
    // again on every answer would be a question that never ended while anybody
    // was still pressing buttons.
    expect(timerOn(halfAnswered).beat).toBe(timerOn(asked).beat);
    expect(timerOn(advancing(advancing(asked))).beat).not.toBe(timerOn(asked).beat);
  });

  it('is nothing on a beat the room is not being timed on', () => {
    const asked = gameWith(ADA, GRACE);
    // The reveal is ended by the phones (`revealBeat`), not by the room's own
    // clock, and a finished game has no next beat at all.
    const revealed = advancing(asked);

    expect(questionTimer(revealed)).toBeUndefined();
    expect(questionTimer({ ...revealed, phase: 'finished' })).toBeUndefined();
  });

  it('is inert when it fires on a question the room has already left', () => {
    const asked = gameWith(ADA, GRACE);
    const timer = timerOn(asked);
    // Everybody answered with seconds to spare, so the room revealed the
    // question itself. The deadline still fires; it must do nothing, or the
    // room would lose the reveal it is in the middle of reading.
    const revealed = answering(answering(asked, ADA, 0), GRACE, 0);

    expect(revealed.phase).toBe('reveal');
    expect(triviaGameLogic.reduce(revealed, timer.event)).toBe(revealed);
  });
});
