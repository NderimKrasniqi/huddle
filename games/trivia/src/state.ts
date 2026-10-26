import type { GamePlayerId } from '@huddle/domain';

import type { TriviaState } from './types';

export const INTRO_SECONDS = 3;

export const QUESTION_SECONDS = 20;

export const REVEAL_SECONDS = 30;

export function beatOf(state: TriviaState): string {
  return `${state.questionIndex}:${state.phase}`;
}

export function playersCounted(
  state: TriviaState,
  awayPlayerIds: readonly GamePlayerId[] | undefined,
): number {
  const away = new Set(awayPlayerIds);

  return state.standings.filter(
    (standing) =>
      !away.has(standing.playerId) || Object.hasOwn(state.answers, standing.playerId),
  ).length;
}

export function answersIn(state: TriviaState): number {
  return state.standings.filter((standing) => Object.hasOwn(state.answers, standing.playerId))
    .length;
}
