import type { GamePlayerId } from '@huddle/domain';

import type { TriviaState } from './types';

type AnswerOptionState =
  | 'open'
  | 'lockedIn'
  | 'closed';

export type AnswerOption = {
  readonly optionIndex: number;
  readonly text: string;
  readonly state: AnswerOptionState;
};

type AnswerScreen =
  | {
      readonly kind: 'question';
      readonly questionIndex: number;
      readonly category: string | undefined;
      readonly text: string;
      readonly options: readonly AnswerOption[];
      readonly lockedIn: boolean;
    }
  | { readonly kind: 'eyesUp'; readonly line: string };

const EYES_UP = {
  reveal: 'Eyes up — the answer’s on the TV.',
  finished: 'That’s the last question — final scores on the TV.',
  watching: 'You’re in from the next game — eyes up on the TV.',
} as const;

function isPlaying(state: TriviaState, playerId: GamePlayerId): boolean {
  return state.standings.some((standing) => standing.playerId === playerId);
}

function optionState(chosen: number | undefined, optionIndex: number): AnswerOptionState {
  if (chosen === undefined) {
    return 'open';
  }

  return chosen === optionIndex ? 'lockedIn' : 'closed';
}

export function answerScreen(state: TriviaState, playerId: GamePlayerId): AnswerScreen {
  const current = state;

  if (current.phase === 'intro') {
    return { kind: 'eyesUp', line: 'Get ready — eyes up on the TV.' };
  }

  const question = current.questions[current.questionIndex];

  if (current.phase === 'finished') {
    return { kind: 'eyesUp', line: EYES_UP.finished };
  }

  if (current.phase === 'reveal' || question === undefined) {
    return { kind: 'eyesUp', line: EYES_UP.reveal };
  }

  if (!isPlaying(current, playerId)) {
    return { kind: 'eyesUp', line: EYES_UP.watching };
  }

  const answered = Object.hasOwn(current.answers, playerId) ? current.answers[playerId] : undefined;
  const chosen = answered !== undefined && answered >= 0 ? answered : undefined;

  return {
    kind: 'question',
    questionIndex: current.questionIndex,
    category: question.category,
    text: question.text,
    options: question.options.map((text, optionIndex) => ({
      optionIndex,
      text,
      state: optionState(chosen, optionIndex),
    })),
    lockedIn: chosen !== undefined,
  };
}
