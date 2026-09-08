import type { GameDeadline, GameLogic, GamePlayerId, GameSettings } from '@huddle/domain';

import { triviaMetadata } from './metadata';
import { questionsFor, type TriviaQuestion } from './questions';
import {
  triviaSettings,
  TRIVIA_SETTINGS_PRESENTATION,
  TRIVIA_SETTINGS_SCHEMA,
} from './settings';
import {
  answersIn,
  beatOf,
  INTRO_SECONDS,
  playersCounted,
  QUESTION_SECONDS,
  REVEAL_SECONDS,
} from './state';
import { triviaEventSchema, triviaStateSchema } from './schemas';
import type {
  PlayableTriviaState,
  TriviaAdvance,
  TriviaEvent,
  TriviaStanding,
  TriviaState,
} from './types';

export {
  answersIn,
  beatOf,
  INTRO_SECONDS,
  playersCounted,
  QUESTION_SECONDS,
  REVEAL_SECONDS,
} from './state';
export { triviaEventSchema, triviaStateSchema } from './schemas';
export type {
  LegacyTriviaState,
  PlayableTriviaState,
  TriviaAdvance,
  TriviaEvent,
  TriviaPhase,
  TriviaStanding,
  TriviaState,
} from './types';

export const FLAT_SCORE_PER_CORRECT_ANSWER = 100;
export const SPEED_BONUS_PER_CORRECT_ANSWER = 100;

/** A legacy launch-proof room must remain readable but cannot be advanced. */
function playable(state: TriviaState): PlayableTriviaState | undefined {
  return state.phase === 'entered' ? undefined : state;
}

/** Highest score first, retaining the original order for ties. */
function inScoreOrder(standings: readonly TriviaStanding[]): readonly TriviaStanding[] {
  return [...standings].sort((first, second) => second.score - first.score);
}

function isPlaying(state: PlayableTriviaState, playerId: GamePlayerId): boolean {
  return state.standings.some((standing) => standing.playerId === playerId);
}

function secondsLeftOn(msRemaining: number | undefined, questionSeconds: number): number {
  if (msRemaining === undefined || !Number.isFinite(msRemaining)) return 0;
  return Math.min(Math.max(msRemaining / 1000, 0), questionSeconds);
}

/** Price a correct answer using the timer selected for this game. */
function scoreForCorrectAnswer(state: PlayableTriviaState, secondsRemaining: number): number {
  if (state.scoring !== 'speed') return FLAT_SCORE_PER_CORRECT_ANSWER;

  const questionSeconds = state.questionSeconds ?? QUESTION_SECONDS;
  return (
    FLAT_SCORE_PER_CORRECT_ANSWER +
    Math.round((SPEED_BONUS_PER_CORRECT_ANSWER * secondsRemaining) / questionSeconds)
  );
}

/** Move the current question into its shared reveal and update the standings. */
function revealed(state: PlayableTriviaState): PlayableTriviaState {
  const question = state.questions[state.questionIndex];
  if (question === undefined) return state;

  const scored = state.standings.map((standing) => ({
    playerId: standing.playerId,
    score:
      standing.score +
      (state.answers[standing.playerId] === question.correctIndex
        ? scoreForCorrectAnswer(state, state.answerSeconds?.[standing.playerId] ?? 0)
        : 0),
  }));

  return { ...state, phase: 'reveal', standings: inScoreOrder(scored) };
}

/** Apply a first answer only while its question is still live. */
function answerTaken(
  state: PlayableTriviaState,
  event: Extract<TriviaEvent, { kind: 'answer' }>,
): PlayableTriviaState {
  const question = state.questions[state.questionIndex];
  if (
    state.phase !== 'question' ||
    question === undefined ||
    event.questionIndex !== state.questionIndex ||
    !isPlaying(state, event.playerId) ||
    Object.hasOwn(state.answers, event.playerId) ||
    !Number.isInteger(event.optionIndex) ||
    event.optionIndex < 0 ||
    event.optionIndex >= question.options.length
  ) {
    return state;
  }

  const answers = { ...state.answers, [event.playerId]: event.optionIndex };
  const answerSeconds = {
    ...state.answerSeconds,
    [event.playerId]: secondsLeftOn(
      event.msRemaining,
      state.questionSeconds ?? QUESTION_SECONDS,
    ),
  };
  const answered = { ...state, answers, answerSeconds };
  const counted = playersCounted(answered, event.awayPlayerIds);

  // If every player the room can currently hear has answered, reveal early.
  // An entirely quiet room stays on the server-owned question timer.
  return counted > 0 && answersIn(answered) === counted ? revealed(answered) : answered;
}

/** Apply a server-owned deadline event to the beat it names. */
function advanced(
  state: PlayableTriviaState,
  event: Extract<TriviaEvent, { kind: 'advance' }>,
): PlayableTriviaState {
  // Phones can never advance a beat; only the scheduler supplies an absent id.
  if (event.playerId !== undefined) return state;
  if (event.questionIndex !== state.questionIndex || event.phase !== state.phase) return state;

  switch (state.phase) {
    case 'intro':
      return { ...state, phase: 'question' };
    case 'question':
      return revealed(state);
    case 'reveal': {
      const nextIndex = state.questionIndex + 1;
      return nextIndex < state.questions.length
        ? { ...state, phase: 'question', questionIndex: nextIndex, answers: {}, answerSeconds: {} }
        : { ...state, phase: 'finished' };
    }
    case 'finished':
      return state;
  }
}

export const HIDDEN_CORRECT_INDEX = -2;

const WITHHELD_QUESTION: TriviaQuestion = {
  text: '',
  options: ['', '', '', ''],
  correctIndex: HIDDEN_CORRECT_INDEX,
};

/** Keep only the question the room has reached; hide its answer until reveal. */
function questionsAsAsked(state: PlayableTriviaState): readonly TriviaQuestion[] {
  if (state.phase !== 'question') return state.questions.map(() => WITHHELD_QUESTION);

  return state.questions.map((question, index) => {
    if (index > state.questionIndex) return WITHHELD_QUESTION;
    return { ...question, correctIndex: HIDDEN_CORRECT_INDEX };
  });
}

/**
 * A question projection for a reveal only needs the current shared prompt and
 * answer key. Earlier questions have already left the stage and future ones
 * must remain server-only. Phones receive the withheld form for every phase
 * after question time, since their renderer is eyes-up and has no reason to
 * retain the deck.
 */
function questionsForViewer(
  state: PlayableTriviaState,
  viewer: GamePlayerId | undefined,
): readonly TriviaQuestion[] {
  if (state.phase === 'question') return questionsAsAsked(state);

  if (state.phase === 'reveal' && viewer === undefined) {
    return state.questions.map((question, index) =>
      index === state.questionIndex ? question : WITHHELD_QUESTION,
    );
  }

  return state.questions.map(() => WITHHELD_QUESTION);
}

/** Normalize the just-revealed outcome for the shared TV projection. */
function revealVerdictsFor(
  state: PlayableTriviaState,
): Readonly<Record<GamePlayerId, boolean>> {
  const question = state.questions[state.questionIndex];
  if (question === undefined) return {};

  return Object.fromEntries(
    state.standings.map(({ playerId }) => [
      playerId,
      state.answers?.[playerId] === question.correctIndex,
    ]),
  );
}

/** Project one state for TV or a single phone without leaking private answers. */
export function redactTriviaStateFor(
  state: TriviaState,
  viewer: GamePlayerId | undefined,
): TriviaState {
  const current = playable(state);
  if (current === undefined) return state;

  const ownAnswer = viewer === undefined ? undefined : current.answers?.[viewer];
  const answers = current.phase === 'question' && viewer !== undefined && ownAnswer !== undefined
    ? { [viewer]: ownAnswer }
    : {};
  const projected = {
    ...current,
    questions: questionsForViewer(current, viewer),
    answers,
    // Answer timing is a scoring input and is never a client concern, even
    // after the reveal has made the shared outcome visible.
    answerSeconds: undefined,
    // Every client may show the same safe participation progress. Phones get
    // only their own answer above; this count carries no answer choice or
    // timing information about any other player.
    participationCount:
      current.phase === 'question'
        ? Object.keys(current.answers ?? {}).length
        : undefined,
    // Only the TV gets normalized reveal outcomes. Phones must not receive a
    // field from which they could infer another player's answer or timing.
    revealVerdicts:
      current.phase === 'reveal' && viewer === undefined
        ? revealVerdictsFor(current)
        : undefined,
  };

  return projected;
}

export const triviaGameLogic: GameLogic<TriviaState, TriviaEvent, GameSettings> = {
  stateVersion: 2,
  decodeState: (value) => triviaStateSchema.parse(value) as TriviaState,
  decodeEvent: (value) => triviaEventSchema.parse(value) as TriviaEvent,
  metadata: triviaMetadata,
  settingsSchema: TRIVIA_SETTINGS_SCHEMA,
  settingsPresentation: TRIVIA_SETTINGS_PRESENTATION,
  createInitialState: ({ players, settings }) => {
    const chosen = triviaSettings(settings);

    return {
      questions: questionsFor(chosen.category, chosen.questions, chosen.difficulty),
      questionIndex: 0,
      questionSeconds: chosen.questionSeconds,
      phase: 'intro',
      answers: {},
      answerSeconds: {},
      standings: players.map((player) => ({ playerId: player.playerId, score: 0 })),
      scoring: chosen.scoring,
    };
  },
  reduce: (state, event) => {
    const current = playable(state);
    if (current === undefined) return state;

    switch (event.kind) {
      case 'answer':
        return answerTaken(current, event);
      case 'advance':
        return advanced(current, event);
    }
  },
  deadline: (state) => introTimer(state) ?? questionTimer(state) ?? revealTimer(state),
  redactStateFor: redactTriviaStateFor,
  isFinished: (state) => state.phase !== 'entered' && state.phase === 'finished',
};

export function introTimer(state: TriviaState): GameDeadline<TriviaAdvance> | undefined {
  if (state.phase === 'entered' || state.phase !== 'intro') return undefined;

  return {
    beat: beatOf(state),
    afterMs: INTRO_SECONDS * 1000,
    event: { kind: 'advance', questionIndex: state.questionIndex, phase: 'intro' },
  };
}

export function questionTimer(state: TriviaState): GameDeadline<TriviaAdvance> | undefined {
  if (state.phase === 'entered' || state.phase !== 'question') return undefined;

  return {
    beat: beatOf(state),
    afterMs: (state.questionSeconds ?? QUESTION_SECONDS) * 1000,
    event: { kind: 'advance', questionIndex: state.questionIndex, phase: 'question' },
  };
}

export function revealTimer(state: TriviaState): GameDeadline<TriviaAdvance> | undefined {
  if (state.phase === 'entered' || state.phase !== 'reveal') return undefined;

  return {
    beat: beatOf(state),
    afterMs: REVEAL_SECONDS * 1000,
    event: { kind: 'advance', questionIndex: state.questionIndex, phase: 'reveal' },
  };
}
