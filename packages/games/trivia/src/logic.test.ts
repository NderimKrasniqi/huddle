import { type GamePlayer, type GameSettings, settingsFrom } from '@huddle/game-core';
import { describe, expect, it } from 'vitest';

import {
  answersIn,
  HIDDEN_ANSWER,
  HIDDEN_CORRECT_INDEX,
  playersCounted,
  QUESTION_SECONDS,
  questionTimer,
  REVEAL_SECONDS,
  revealTimer,
  triviaEventSchema,
  triviaGameLogic,
  triviaStateSchema,
  type TriviaState,
} from './logic';
import { EVERY_CATEGORY, PACK_CATEGORIES } from './questions';
import { CURATED_PACK } from './content/curated-pack';
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
  return { playerId, nickname: playerId, away: false, avatar: 'fox' };
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

/**
 * A player locking an option in, with the room's clock on it where the test
 * cares what it read.
 *
 * `msRemaining` is the hub's, never the phone's (see `GameEvent`), and is left
 * off everywhere flat scoring is being tested — a flat game is worth the same
 * whenever it was answered, so the timing is exactly the noise those tests do
 * not need.
 */
function answering(
  state: TriviaState,
  playerId: string,
  optionIndex: number,
  msRemaining?: number,
): TriviaState {
  return triviaGameLogic.reduce(state, {
    kind: 'answer',
    playerId,
    questionIndex: state.questionIndex,
    optionIndex,
    msRemaining,
  });
}

/**
 * The same answer, in a room the hub says has gone quiet — the away list is the
 * room's and rides the event (`GameEvent`), so it is named at the tap.
 *
 * Left off `answering` above, since a room with everybody present is what every
 * other rule here is about.
 */
function answeringWhileAway(
  state: TriviaState,
  playerId: string,
  optionIndex: number,
  awayPlayerIds: readonly string[],
): TriviaState {
  return triviaGameLogic.reduce(state, {
    kind: 'answer',
    playerId,
    questionIndex: state.questionIndex,
    optionIndex,
    awayPlayerIds,
  });
}

/** The room's clock moving on: a reveal ending, or a question timing out. */
function advancing(state: TriviaState): TriviaState {
  return triviaGameLogic.reduce(state, advanceOf(state));
}

/** The deadline event addressed to the beat this state is on. */
function advanceOf(state: TriviaState) {
  return {
    kind: 'advance',
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
  it('decodes only strict state and event shapes', () => {
    const state = gameWith(ADA, GRACE);
    const event = { kind: 'answer' as const, playerId: ADA, questionIndex: 0, optionIndex: 0 };

    expect(triviaStateSchema.parse(state)).toEqual(state);
    expect(triviaEventSchema.parse(event)).toEqual(event);
    expect(() => triviaStateSchema.parse({ ...state, extra: true })).toThrow();
    expect(() => triviaEventSchema.parse({ ...event, extra: true })).toThrow();
  });

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

  it('ignores an advance attributed to a player', () => {
    const asked = gameWith(ADA, GRACE);

    expect(
      triviaGameLogic.reduce(asked, {
        kind: 'advance',
        playerId: ADA,
        questionIndex: asked.questionIndex,
        phase: asked.phase,
      }),
    ).toBe(asked);
  });

  it('ignores a second “move on” for a beat the room has left', () => {
    const revealed = advancing(gameWith(ADA, GRACE));
    const endReveal = advanceOf(revealed);

    // A duplicate callback arriving after the first has already moved the room.
    const second = triviaGameLogic.reduce(triviaGameLogic.reduce(revealed, endReveal), endReveal);

    // The duplicate must not end the question it landed on: revealing question
    // two here would score the room nothing on a question it never read, and
    // the next "move on" would take the game past it entirely.
    expect(second.phase).toBe('question');
    expect(second.questionIndex).toBe(1);
  });

  it('ignores a “move on” for a question the last answer already ended', () => {
    const asked = gameWith(ADA, GRACE);
    // Sent while the question was still up and landing just after the last
    // player's answer had revealed it. Same question, a beat later.
    const skip = advanceOf(asked);
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
    const stale = advanceOf(asked);
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
  it('is owned by the server deadline', () => {
    const revealed = triviaGameLogic.reduce(gameWith(ADA, GRACE), {
      kind: 'advance',
      questionIndex: 0,
      phase: 'question',
    });

    expect(revealTimer(revealed)).toMatchObject({ afterMs: REVEAL_SECONDS * 1000 });
    expect(triviaGameLogic.deadline?.(revealed)?.event).toEqual({
      kind: 'advance',
      questionIndex: 0,
      phase: 'reveal',
    });
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
    // The reveal is ended by the room's own server clock, and a finished game
    // has no next beat at all.
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

/**
 * Who a question waits for, which is everybody the room is still hearing from.
 *
 * Away is the room's reading and not the game's, so it arrives on the answer
 * event the way the clock does, and every test here hands it over the way
 * `sendEvent` does.
 */
describe('a player the room has stopped hearing from', () => {
  const LINUS = 'p3';

  it('is not waited for: the question ends on the last answer the room can expect', () => {
    const asked = gameWith(ADA, GRACE);
    const revealed = answeringWhileAway(asked, ADA, rightAnswerTo(asked), [GRACE]);

    // Without this the room sits through the whole twenty seconds every time a
    // phone is face-down on the table, which is the interim the Question Timer
    // was bounding.
    expect(revealed.phase).toBe('reveal');
    expect(scoreOf(revealed, ADA)).toBe(100);
    // Away scores exactly what no answer scores, which is what it is.
    expect(scoreOf(revealed, GRACE)).toBe(0);
  });

  it('may still answer the question they came back to, while it is up', () => {
    const asked = gameWith(ADA, GRACE, LINUS);
    // Grace's phone woke up and answered before the room heard her Heartbeat,
    // so the room still has her down as away. Being away is not being out.
    const back = answeringWhileAway(asked, GRACE, rightAnswerTo(asked), [GRACE]);

    expect(back.phase).toBe('question');
    expect(back.answers).toEqual({ [GRACE]: rightAnswerTo(asked) });

    const revealed = answeringWhileAway(back, ADA, wrongAnswerTo(asked), [GRACE, LINUS]);

    expect(revealed.phase).toBe('reveal');
    expect(scoreOf(revealed, GRACE)).toBe(100);
  });

  it('cannot undo the reveal their return lands after', () => {
    const asked = gameWith(ADA, GRACE);
    const revealed = answeringWhileAway(asked, ADA, rightAnswerTo(asked), [GRACE]);
    // Back a beat too late: the question she is answering is already revealed,
    // and a reveal the room has read cannot be taken back off the television.
    const late = answeringWhileAway(revealed, GRACE, rightAnswerTo(asked), []);

    expect(late).toBe(revealed);
    expect(scoreOf(late, GRACE)).toBe(0);
  });

  it('leaves a room where every phone has gone quiet to its Question Timer', () => {
    const asked = gameWith(ADA, GRACE);

    // Nobody counted and nothing answered: the question would otherwise be up
    // with nobody left to wait for, which would reveal it the instant it went
    // up. The room's own clock is what ends this one.
    expect(playersCounted(asked, [ADA, GRACE])).toBe(0);
    expect(advancing(asked).phase).toBe('reveal');
  });

  it('ends the question on the answer of the one player who came back to it', () => {
    const asked = gameWith(ADA, GRACE);
    const oneBack = answeringWhileAway(asked, ADA, rightAnswerTo(asked), [ADA, GRACE]);

    // The other end of the same room: answering counts Ada back in, and she is
    // then the whole of who the question is waiting for — which is exactly what
    // the television is saying while she does it (see `watching.test.ts`).
    expect(playersCounted(oneBack, [ADA, GRACE])).toBe(1);
    expect(answersIn(oneBack)).toBe(1);
    expect(oneBack.phase).toBe('reveal');
    expect(scoreOf(oneBack, ADA)).toBe(100);
  });

  it('is waited for when the room could not say who is away at all', () => {
    const asked = gameWith(ADA, GRACE);

    // No away list is a room that did not say, which is every room dealt its
    // question by a deployment older than the field: it waits for everybody,
    // exactly as it did before there was one.
    expect(answering(asked, ADA, rightAnswerTo(asked)).phase).toBe('question');
  });
});

/**
 * What a correct answer is worth, which is the one thing the Host's Scoring Mode
 * changes.
 *
 * The seconds a question had left are not the rules' to read — a reducer has no
 * clock — so they arrive on the answer event, timed by the hub, and every test
 * here hands them over the way `sendEvent` does.
 */
describe('the Scoring Mode a Host chose', () => {
  /** A game started on a scoring mode, settled the way `startGame` settles it. */
  function gameScored(scoring: string): TriviaState {
    return startedOn({ scoring }, ADA, GRACE);
  }

  /**
   * What Ada scores for one answer, on a question Grace ends by answering
   * wrongly — so the reveal happens on the beat the answer was given, and the
   * only score in it is the one being asserted.
   */
  function scoreFor(
    scoring: string,
    answer: 'right' | 'wrong',
    msRemaining?: number,
  ): number | undefined {
    const asked = gameScored(scoring);
    const option = answer === 'right' ? rightAnswerTo(asked) : wrongAnswerTo(asked);
    const revealed = answering(
      answering(asked, ADA, option, msRemaining),
      GRACE,
      wrongAnswerTo(asked),
      msRemaining,
    );

    expect(revealed.phase).toBe('reveal');

    return scoreOf(revealed, ADA);
  }

  it('pays a speed answer the hundred plus the seconds it did not use', () => {
    // The plan's own example: fifteen of the twenty seconds still on the clock.
    expect(scoreFor('speed', 'right', 15_000)).toBe(175);
  });

  it('pays a speed answer that used the whole question the hundred and no more', () => {
    expect(scoreFor('speed', 'right', 0)).toBe(100);
  });

  it('pays the full bonus to a thumb that lands as the question opens', () => {
    expect(scoreFor('speed', 'right', QUESTION_SECONDS * 1000)).toBe(200);
  });

  it('rounds the bonus rather than truncating it', () => {
    // Seven and a half seconds is 37.5 points of bonus, and the half goes up.
    expect(scoreFor('speed', 'right', 7_500)).toBe(138);
  });

  it('pays a wrong answer nothing, however fast it was', () => {
    expect(scoreFor('speed', 'wrong', QUESTION_SECONDS * 1000)).toBe(0);
    expect(scoreFor('speed', 'wrong', 0)).toBe(0);
  });

  it('pays a player who never answered nothing, which is what the timer leaves them', () => {
    const asked = gameScored('speed');
    // Ada answers instantly and the Question Timer ends it, so Grace's phone
    // never sent anything at all.
    const revealed = advancing(answering(asked, ADA, rightAnswerTo(asked), 20_000));

    expect(scoreOf(revealed, ADA)).toBe(200);
    expect(scoreOf(revealed, GRACE)).toBe(0);
  });

  it('pays no more than a full question and no less than nothing', () => {
    // A clock the hub read as longer than the question, or as already overdue.
    // Neither is a score the rules will pay: the bonus is what the question's
    // own twenty seconds are worth, and a late answer is worth a flat one.
    expect(scoreFor('speed', 'right', QUESTION_SECONDS * 1000 + 5_000)).toBe(200);
    expect(scoreFor('speed', 'right', -1_000)).toBe(100);
  });

  it('pays a speed answer the room could not time exactly the hundred', () => {
    // No clock was running on the beat, or the room was dealt it by a
    // deployment older than the field its deadline is stored in. The safe
    // direction: an answer that may have taken the whole twenty seconds is
    // never paid a bonus for seconds nobody watched.
    expect(scoreFor('speed', 'right', undefined)).toBe(100);
  });

  it('pays a flat answer a hundred whenever it lands', () => {
    // Flat is the default and the mode most rooms play: the clock reaching the
    // rules must not have changed a single score in it.
    expect(scoreFor('flat', 'right', QUESTION_SECONDS * 1000)).toBe(100);
    expect(scoreFor('flat', 'right', 15_000)).toBe(100);
    expect(scoreFor('flat', 'right', 0)).toBe(100);
    expect(scoreFor('flat', 'wrong', 15_000)).toBe(0);
  });

  it('carries the Host’s choice in the state, since the reveal is where it is read', () => {
    expect(gameScored('speed').scoring).toBe('speed');
    expect(gameScored('flat').scoring).toBe('flat');
  });

  it('scores a game dealt before speed scoring flat, rather than on nothing', () => {
    const asked = gameScored('speed');
    // A room mid-question when this landed: its state carries neither the mode
    // nor any timing, and it must finish the game it is in unharmed.
    const dealtEarlier: TriviaState = { ...asked, scoring: undefined, answerSeconds: undefined };
    const revealed = answering(
      answering(dealtEarlier, ADA, rightAnswerTo(asked), 20_000),
      GRACE,
      wrongAnswerTo(asked),
    );

    expect(scoreOf(revealed, ADA)).toBe(100);
    expect(scoreOf(revealed, GRACE)).toBe(0);
  });
});

/**
 * What a game of trivia looks like from outside the room's own row.
 *
 * The rules run on the state the room stored; this is the copy every client is
 * handed instead (`GameLogic.redactStateFor`, applied in `games.running`). Two
 * different things are held back while a question is up — one player's choice,
 * which is theirs, and the answers to the questions, which nobody has earned yet
 * — so both are asserted here rather than only through the hub.
 */
describe('the game as a client is shown it', () => {
  const redact = (state: TriviaState, viewer: string | undefined) =>
    triviaGameLogic.redactStateFor?.(state, viewer) ?? state;

  it('hides another player’s answer while the question is up', () => {
    const answered = answering(gameWith(ADA, GRACE), GRACE, 2);

    // Ada is playing and has not answered; she may know that Grace is in, and
    // not what Grace chose.
    expect(redact(answered, ADA).answers).toEqual({ [GRACE]: HIDDEN_ANSWER });
    // The television is nobody at all.
    expect(redact(answered, undefined).answers).toEqual({ [GRACE]: HIDDEN_ANSWER });
  });

  it('shows a player their own answer', () => {
    const answered = answering(gameWith(ADA, GRACE), GRACE, 2);

    expect(redact(answered, GRACE).answers).toEqual({ [GRACE]: 2 });
  });

  it('keeps the count the television draws', () => {
    const answered = answering(gameWith(ADA, GRACE), GRACE, 2);

    // The chip is the keys of `answers` (`answersIn`), so hiding the values must
    // not move it — this is the whole reason a sentinel is used rather than
    // dropping the entry.
    expect(answersIn(redact(answered, undefined))).toBe(answersIn(answered));
    expect(answersIn(redact(answered, undefined))).toBe(1);
  });

  it('withholds the timings only the reveal reads', () => {
    const answered = answering(gameWith(ADA, GRACE), GRACE, 2, 9_000);

    expect(answered.answerSeconds).not.toEqual({});
    expect(redact(answered, GRACE).answerSeconds).toBeUndefined();
  });

  it('withholds every question’s answer while one is being asked', () => {
    const playing = gameWith(ADA, GRACE);

    const shown = redact(playing, ADA);

    // Not one of them, and not merely the one on screen: the whole game is dealt
    // at the start, so the rest of it is sitting in the same row.
    expect(shown.questions.every((q) => q.correctIndex === HIDDEN_CORRECT_INDEX)).toBe(true);
    expect(shown.questions).toHaveLength(playing.questions.length);
  });

  it('withholds the questions the room has not reached', () => {
    const playing = gameWith(ADA, GRACE);

    const shown = redact(playing, ADA);

    // The one being asked is readable, because the room is reading it.
    expect(shown.questions[0]?.text).toBe(playing.questions[0]?.text);
    expect(shown.questions[0]?.options).toEqual(playing.questions[0]?.options);
    // What comes next is not.
    expect(shown.questions[1]?.text).toBe('');
    expect(shown.questions[1]?.options).toEqual(['', '', '', '']);
  });

  it('gives up the answer to the question it has just revealed', () => {
    const playing = gameWith(ADA, GRACE);
    const revealed = advancing(playing);

    const shown = redact(revealed, undefined);

    expect(revealed.phase).toBe('reveal');
    // The reveal is what that one answer was being held back *for*, and the
    // options and verdicts on screen are read off it.
    expect(shown.questions[0]?.correctIndex).toBe(playing.questions[0]?.correctIndex);
    // The answers themselves stop being private here too — the reveal is the
    // screen that shows who picked what.
    expect(shown.answers).toEqual(revealed.answers);
  });

  it('still withholds the rest of the game at the reveal', () => {
    const revealed = advancing(gameWith(ADA, GRACE));

    const shown = redact(revealed, undefined);

    // The beat a client would wait for: five seconds of reveal stand between
    // every pair of questions, so relaxing here would hand over the remaining
    // answers to anybody willing to sit through question one.
    expect(shown.questions[1]?.text).toBe('');
    expect(shown.questions[1]?.correctIndex).toBe(HIDDEN_CORRECT_INDEX);
  });

  it('withholds nothing behind the room in a finished game', () => {
    let state = shortGameWith(ADA, GRACE);

    while (state.phase !== 'finished') {
      state = advancing(state);
    }

    // A finished game has been asked every question it holds, so there is
    // nothing left in front of the room to keep from it.
    expect(redact(state, undefined)).toEqual(state);
  });

  it('is a view and never an input to the rules', () => {
    const playing = gameWith(ADA, GRACE);
    const right = rightAnswerTo(playing);

    // The same correct answer, played out twice: once on the state the room
    // stored, and once on the copy a client is shown.
    const scoredOnStored = advancing(answering(playing, ADA, right));
    const scoredOnShown = advancing(answering(redact(playing, ADA), ADA, right));

    expect(scoreOf(scoredOnStored, ADA)).toBe(100);
    // Reducing the projection gets it *wrong* — the answer key is not in it, so
    // a right answer scores nothing. That is the whole reason `games.running`
    // redacts on the way out and `playGameEvent` reduces the row: the two must
    // never be swapped, and this is what that would cost.
    expect(scoreOf(scoredOnShown, ADA)).toBe(0);
  });

  it('survives a state that carries no answers at all', () => {
    // A room dealt by a deployment older than the field, or a shape nothing has
    // written yet. This runs on the read path, so throwing here would take
    // `running` down for every client in the room.
    const playing = { ...gameWith(ADA, GRACE), answers: undefined } as unknown as TriviaState;

    expect(() => redact(playing, ADA)).not.toThrow();
    expect(redact(playing, ADA).answers).toEqual({});
  });
});
