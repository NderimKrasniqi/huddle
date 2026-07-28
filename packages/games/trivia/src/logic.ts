import type { GameLogic, GamePlayerId } from '@huddle/game-core';

import { INLINE_QUESTIONS, type TriviaQuestion } from './questions';

/**
 * Trivia's rules, with no screens attached.
 *
 * This is the half that runs inside a Convex mutation, which is why it is its
 * own module and its own package entry point (`@huddle/game-trivia/logic`): the
 * server seeds a game's state and reduces its events, and must not carry the
 * React Native that draws it. `./trivia` is where the screens are put back on
 * top for the two clients.
 */

/** What a correct answer is worth in the flat Scoring Mode. */
export const FLAT_SCORE_PER_CORRECT_ANSWER = 100;

/**
 * Where a game of trivia is: a question on screen, its Reveal, or over.
 *
 * The three beats of the loop the TV draws (docs/implementation-plan.md, Phase
 * 3): the question with its four options, the reveal with the right answer and
 * the running scoreboard, and the final standings.
 */
export type TriviaPhase = 'question' | 'reveal' | 'finished';

/** One row of the scoreboard: a player and what they have scored so far. */
export type TriviaStanding = {
  readonly playerId: GamePlayerId;
  readonly score: number;
};

/**
 * A game of trivia in progress.
 *
 * The standings are the players: everyone the game was started with has a row
 * from the first question, so this list is both the scoreboard and the answer
 * to "who is playing". It is held in scoreboard order — highest first, ties in
 * the order they already had — so the running scoreboard, the Victory Screen
 * and the finished state are one ordering decided once here, rather than the
 * same sort written again on every screen that draws it.
 *
 * `answers` is the current question's only: it is cleared when the room moves
 * to the next one, and a player missing from it is a player who has not
 * answered — which scores exactly what a wrong answer scores.
 */
export type TriviaState = {
  readonly questions: readonly TriviaQuestion[];
  /** Which question is up; the last one played once the game is finished. */
  readonly questionIndex: number;
  readonly phase: TriviaPhase;
  /** The current question's answers: player → the option they locked in. */
  readonly answers: Readonly<Record<GamePlayerId, number>>;
  readonly standings: readonly TriviaStanding[];
};

/**
 * What a player does in a game of trivia, and what moves the room on.
 *
 * `answer` names the question it was aimed at, because a phone's tap and the
 * room's beat race: a tap that leaves while question one is up must answer
 * question one or nothing at all, never whatever is on screen when it lands.
 *
 * `advance` is the room finishing a beat — a reveal ending, or a question the
 * room stops waiting on. It carries a `playerId` because every Game Event does:
 * the hub delivers events on behalf of the phone that sent them.
 *
 * It is addressed the same way, and has to be: it is the room's only "move on"
 * signal and nothing owns it, so every source of it races every other — Phase
 * 4's countdown, a Host skipping ahead, and a "next" on any of ten phones. It
 * names both the question it is ending and the beat of it, because a bare
 * "move on" arriving a beat late lands on the next question and reveals it to a
 * room that has not read it yet, losing a whole question and the scores from
 * it. Naming both makes the second of two thumbs a beat apart do nothing.
 */
export type TriviaEvent =
  | {
      readonly kind: 'answer';
      readonly playerId: GamePlayerId;
      readonly questionIndex: number;
      readonly optionIndex: number;
    }
  | {
      readonly kind: 'advance';
      readonly playerId: GamePlayerId;
      readonly questionIndex: number;
      /** The beat being ended: the question on screen, or its reveal. */
      readonly phase: TriviaPhase;
    };

/** The scoreboard order: highest first, ties left in the order they had. */
function inScoreOrder(standings: readonly TriviaStanding[]): readonly TriviaStanding[] {
  // `Array#sort` is stable, so players on equal scores keep their places
  // instead of trading them every time somebody else scores.
  return [...standings].sort((first, second) => second.score - first.score);
}

function isPlaying(state: TriviaState, playerId: GamePlayerId): boolean {
  return state.standings.some((standing) => standing.playerId === playerId);
}

/**
 * The question ends: the right answer goes up on the TV and the scores catch
 * up with it.
 *
 * Scoring happens here rather than when an answer is taken, because a score
 * that moved the moment a phone was tapped would tell the room what the right
 * answer was before the reveal did.
 */
function revealed(state: TriviaState): TriviaState {
  const question = state.questions[state.questionIndex];

  // A game only runs out of questions by finishing, so this is the type
  // system's question and not the game's.
  if (question === undefined) {
    return state;
  }

  const scored = state.standings.map((standing) => ({
    playerId: standing.playerId,
    score:
      standing.score +
      (state.answers[standing.playerId] === question.correctIndex
        ? FLAT_SCORE_PER_CORRECT_ANSWER
        : 0),
  }));

  return { ...state, phase: 'reveal', standings: inScoreOrder(scored) };
}

/** A player locks in an option: their first one, on the question they were shown. */
function answerTaken(
  state: TriviaState,
  event: Extract<TriviaEvent, { kind: 'answer' }>,
): TriviaState {
  const question = state.questions[state.questionIndex];

  if (
    // Nothing to answer: the reveal is up, or the game is over.
    state.phase !== 'question' ||
    question === undefined ||
    // A stale tap, aimed at a question the room has moved on from.
    event.questionIndex !== state.questionIndex ||
    !isPlaying(state, event.playerId) ||
    // Locked in already: a second tap changes nothing, which is the rule the
    // phone's answer screen draws as disabled buttons.
    Object.hasOwn(state.answers, event.playerId) ||
    !Number.isInteger(event.optionIndex) ||
    event.optionIndex < 0 ||
    event.optionIndex >= question.options.length
  ) {
    return state;
  }

  const answers = { ...state.answers, [event.playerId]: event.optionIndex };
  const answered = { ...state, answers };

  // The last player to answer ends the question: there is nobody left to wait
  // for, so the room is not made to sit through a countdown it is done with.
  return state.standings.every((standing) => Object.hasOwn(answers, standing.playerId))
    ? revealed(answered)
    : answered;
}

/** The room moves on from the beat this event named. */
function advanced(
  state: TriviaState,
  event: Extract<TriviaEvent, { kind: 'advance' }>,
): TriviaState {
  // Already moved on: this is a second "next" for a beat the room has left, and
  // acting on it would end the beat that replaced it — revealing a question
  // nobody has been given the chance to answer.
  if (event.questionIndex !== state.questionIndex || event.phase !== state.phase) {
    return state;
  }

  switch (state.phase) {
    // Done waiting: whoever has not answered scores what a wrong answer
    // scores, which is nothing.
    case 'question':
      return revealed(state);

    case 'reveal': {
      const nextIndex = state.questionIndex + 1;

      // The last reveal ends the game, and the standings are already in the
      // order the Victory Screen reads them in.
      return nextIndex < state.questions.length
        ? { ...state, phase: 'question', questionIndex: nextIndex, answers: {} }
        : { ...state, phase: 'finished' };
    }

    // A finished game has no next beat. The room leaves it through the Host's
    // "Back to lobby", which is the hub's `endGame` and not trivia's business.
    case 'finished':
      return state;
  }
}

/**
 * Trivia's metadata, settings schema and rules.
 *
 * Its settings schema is still empty: scoring mode, question count and category
 * filter are Phase 4's, along with the Question Packs the last two are about.
 * Today every game is the same three inline questions scored flat — the loop
 * the platform was built to prove, and not yet the game it will ship.
 */
export const triviaGameLogic: GameLogic<TriviaState, TriviaEvent> = {
  metadata: {
    id: 'trivia',
    title: 'Trivia',
    /**
     * Punch, because the accents are spoken for elsewhere and this one is
     * spoken for least: cobalt is the focused card's own offset shadow
     * (docs/design/design-handoff.md §6) and a block would sit on top of it,
     * tangerine is the brand's, green is presence, yellow is the chip printed
     * on the card itself. Its Bungee title sets in ink.
     */
    keyArt: { color: 'punch' },
    /** The scope's "2–10 players", the second of which is a full room. */
    playerRange: { min: 2, max: 10 },
    /**
     * Ten questions — Phase 4's default count — at a 20-second countdown and a
     * five-second reveal apiece, plus the victory screen: about five minutes.
     * The handoff's "~12 min" chip is mock filler; the chip draws whatever the
     * module declares, and this is the number the scoped settings produce.
     */
    estimatedMinutes: 5,
    /** The genre chip. Not one of a Question Pack's categories. */
    category: 'Knowledge',
  },
  settingsSchema: [],
  createInitialState: ({ players }) => ({
    questions: INLINE_QUESTIONS,
    questionIndex: 0,
    phase: 'question',
    answers: {},
    // Roster order, since nobody has scored yet and the sort is stable.
    standings: players.map((player) => ({ playerId: player.playerId, score: 0 })),
  }),
  reduce: (state, event) => {
    switch (event.kind) {
      case 'answer':
        return answerTaken(state, event);

      case 'advance':
        return advanced(state, event);
    }
  },
};
