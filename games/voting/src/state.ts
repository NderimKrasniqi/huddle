import type { GamePlayerId } from '@huddle/domain';

import type { PlayableVotingState, VotingState } from './types';

export const INTRO_SECONDS = 3;
export const REVEAL_SECONDS = 7;
export const NO_TIMER_SAFETY_MS = 5 * 60 * 1000;

export function playableVotingState(state: VotingState): PlayableVotingState | undefined {
  return state.phase === 'entered' ? undefined : state;
}

export function votingBeat(state: PlayableVotingState): string {
  return `${state.roundIndex}:${state.phase}`;
}

export function tallyVotes(
  votes: Readonly<Record<GamePlayerId, number>>,
): [number, number, number, number] {
  const counts: [number, number, number, number] = [0, 0, 0, 0];
  for (const optionIndex of Object.values(votes)) {
    if (Number.isInteger(optionIndex) && optionIndex >= 0 && optionIndex < counts.length) {
      counts[optionIndex] = (counts[optionIndex] ?? 0) + 1;
    }
  }
  return counts;
}

export function votesIn(state: PlayableVotingState): number {
  return state.playerIds.filter((playerId) => Object.hasOwn(state.votes, playerId)).length;
}

export function playersCounted(
  state: PlayableVotingState,
  awayPlayerIds: readonly GamePlayerId[] | undefined,
): number {
  const away = new Set(awayPlayerIds);
  return state.playerIds.filter(
    (playerId) => !away.has(playerId) || Object.hasOwn(state.votes, playerId),
  ).length;
}
