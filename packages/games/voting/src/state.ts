import type { GamePlayerId } from '@huddle/game-core';

import type { VotingState } from './logic';

/** How long a prompt stays open. Kept in this client-safe state seam. */
export const VOTE_SECONDS = 20;

/** How long a revealed tally remains on screen before the next prompt. */
export const REVEAL_SECONDS = 6;

/** The room's denominator for the current prompt, excluding away players. */
export function playersCounted(
  state: VotingState,
  awayPlayerIds: readonly GamePlayerId[] | undefined,
): number {
  const away = new Set(awayPlayerIds);

  return state.players.filter(
    (playerId) => !away.has(playerId) || state.voters.includes(playerId),
  ).length;
}

/** How many ballots have arrived for the current prompt. */
export function votesIn(state: VotingState): number {
  return state.voters.length;
}
