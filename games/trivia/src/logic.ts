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
    TriviaAdvance,
  TriviaEvent,
  TriviaPhase,
  TriviaStanding,
  TriviaState,
} from './types';

const FLAT_SCORE_PER_CORRECT_ANSWER = 100;
const SPEED_BONUS_PER_CORRECT_ANSWER = 100;

function inScoreOrder(standings: readonly TriviaStanding[]): readonly TriviaStanding[] {
  return [...standings].sort((first, second) => second.score - first.score);
}

function isPlaying(state: TriviaState, playerId: GamePlayerId): boolean {
  return state.standings.some((standing) => standing.playerId === playerId);
}

function secondsLeftOn(msRemaining: number | undefined, questionSeconds: number): number {
  if (msRemaining === undefined || !Number.isFinite(msRemaining)) return 0;
  return Math.min(Math.max(msRemaining / 1000, 0), questionSeconds);
}

function scoreForCorrectAnswer(state: TriviaState, secondsRemaining: number): number {
  if (state.scoring !== 'speed') return FLAT_SCORE_PER_CORRECT_ANSWER;

  const questionSeconds = state.questionSeconds ?? QUESTION_SECONDS;
  return (
    FLAT_SCORE_PER_CORRECT_ANSWER +
    Math.round((SPEED_BONUS_PER_CORRECT_ANSWER * secondsRemaining) / questionSeconds)
  );
}

function revealed(state: TriviaState): TriviaState {
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

function answerTaken(
  state: TriviaState,
  event: Extract<TriviaEvent, { kind: 'answer' }>,
): TriviaState {
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

  return counted > 0 && answersIn(answered) === counted ? revealed(answered) : answered;
}

function advanced(
  state: TriviaState,
  event: Extract<TriviaEvent, { kind: 'advance' }>,
): TriviaState {
  if (event.playerId !== undefined && !(event.fromHost === true && event.phase === 'reveal')) return state;
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

const HIDDEN_CORRECT_INDEX = -2;

const WITHHELD_QUESTION: TriviaQuestion = {
  text: '',
  options: ['', '', '', ''],
  correctIndex: HIDDEN_CORRECT_INDEX,
};

function questionsAsAsked(state: TriviaState): readonly TriviaQuestion[] {
  if (state.phase !== 'question') return state.questions.map(() => WITHHELD_QUESTION);

  return state.questions.map((question, index) => {
    if (index > state.questionIndex) return WITHHELD_QUESTION;
    return { ...question, correctIndex: HIDDEN_CORRECT_INDEX };
  });
}

function questionsForViewer(
  state: TriviaState,
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

function revealGainsFor(state: TriviaState): Readonly<Record<GamePlayerId, number>> {
  const question = state.questions[state.questionIndex];
  if (question === undefined) return {};

  return Object.fromEntries(
    state.standings.map(({ playerId }) => [
      playerId,
      state.answers?.[playerId] === question.correctIndex
        ? scoreForCorrectAnswer(state, state.answerSeconds?.[playerId] ?? 0)
        : 0,
    ]),
  );
}

function forViewer(
  all: Readonly<Record<GamePlayerId, boolean>>,
  viewer: GamePlayerId | undefined,
): Readonly<Record<GamePlayerId, boolean>> | undefined {
  if (viewer === undefined) return all;
  return Object.hasOwn(all, viewer) ? { [viewer]: all[viewer] === true } : undefined;
}

function revealAnsweredFor(state: TriviaState): Readonly<Record<GamePlayerId, boolean>> {
  return Object.fromEntries(
    state.standings.map(({ playerId }) => [playerId, state.answers?.[playerId] !== undefined]),
  );
}

function revealVerdictsFor(
  state: TriviaState,
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

function redactTriviaStateFor(
  state: TriviaState,
  viewer: GamePlayerId | undefined,
): TriviaState {
  const current = state;

  const ownAnswer = viewer === undefined ? undefined : current.answers?.[viewer];
  const answers = current.phase === 'question' && viewer !== undefined && ownAnswer !== undefined
    ? { [viewer]: ownAnswer }
    : {};
  const projected = {
    ...current,
    questions: questionsForViewer(current, viewer),
    answers,
    answerSeconds: undefined,
    participationCount:
      current.phase === 'question'
        ? Object.keys(current.answers ?? {}).length
        : undefined,
    revealVerdicts: current.phase === 'reveal' ? forViewer(revealVerdictsFor(current), viewer) : undefined,
    revealAnswered: current.phase === 'reveal' && viewer !== undefined ? forViewer(revealAnsweredFor(current), viewer) : undefined,
    revealGains: current.phase === 'reveal' && viewer === undefined ? revealGainsFor(current) : undefined,
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
  createInitialState: ({ players, settings, seed }) => {
    const chosen = triviaSettings(settings);

    return {
      questions: questionsFor(chosen.category, chosen.questions, chosen.difficulty, seed),
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
    switch (event.kind) {
      case 'answer':
        return answerTaken(state, event);
      case 'advance':
        return advanced(state, event);
    }
  },
  deadline: (state) => introTimer(state) ?? questionTimer(state) ?? revealTimer(state),
  redactStateFor: redactTriviaStateFor,
  isFinished: (state) => state.phase === 'finished',
};

function introTimer(state: TriviaState): GameDeadline<TriviaAdvance> | undefined {
  if (state.phase !== 'intro') return undefined;

  return {
    beat: beatOf(state),
    afterMs: INTRO_SECONDS * 1000,
    event: { kind: 'advance', questionIndex: state.questionIndex, phase: 'intro' },
  };
}

export function questionTimer(state: TriviaState): GameDeadline<TriviaAdvance> | undefined {
  if (state.phase !== 'question') return undefined;

  return {
    beat: beatOf(state),
    afterMs: (state.questionSeconds ?? QUESTION_SECONDS) * 1000,
    event: { kind: 'advance', questionIndex: state.questionIndex, phase: 'question' },
  };
}

function revealTimer(state: TriviaState): GameDeadline<TriviaAdvance> | undefined {
  if (state.phase !== 'reveal') return undefined;

  return {
    beat: beatOf(state),
    afterMs: REVEAL_SECONDS * 1000,
    event: { kind: 'advance', questionIndex: state.questionIndex, phase: 'reveal' },
  };
}
