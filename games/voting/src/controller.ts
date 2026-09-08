import type { GamePlayerId } from '@huddle/domain';

import { playableVotingState } from './state';
import type { VotingState } from './types';

export type VotingChoice = {
  readonly optionIndex: number;
  readonly text: string;
  readonly state: 'open' | 'locked' | 'closed';
};

export type VotingPhoneModel =
  | { readonly kind: 'legacy' }
  | { readonly kind: 'intro'; readonly rounds: number; readonly voteSeconds: number | 'none'; readonly results: 'together' | 'live' }
  | {
      readonly kind: 'vote';
      readonly roundIndex: number;
      readonly roundCount: number;
      readonly text: string;
      readonly choices: readonly VotingChoice[];
      readonly locked: boolean;
    }
  | { readonly kind: 'eyesUp'; readonly roundIndex: number; readonly roundCount: number }
  | { readonly kind: 'finished' }
  | { readonly kind: 'watching' };

export function votingPhoneModel(state: VotingState, playerId: GamePlayerId): VotingPhoneModel {
  const current = playableVotingState(state);
  if (current === undefined) return { kind: 'legacy' };
  if (!current.playerIds.includes(playerId)) return { kind: 'watching' };
  if (current.phase === 'intro') {
    return {
      kind: 'intro',
      rounds: current.prompts.length,
      voteSeconds: current.voteSeconds,
      results: current.results,
    };
  }
  if (current.phase === 'finished') return { kind: 'finished' };
  if (current.phase === 'reveal') {
    return { kind: 'eyesUp', roundIndex: current.roundIndex, roundCount: current.prompts.length };
  }

  const prompt = current.prompts[current.roundIndex];
  if (prompt === undefined || prompt.text === '') return { kind: 'watching' };
  const chosen = Object.hasOwn(current.votes, playerId) ? current.votes[playerId] : undefined;
  return {
    kind: 'vote',
    roundIndex: current.roundIndex,
    roundCount: current.prompts.length,
    text: prompt.text,
    choices: prompt.options.map((text, optionIndex) => ({
      optionIndex,
      text,
      state: chosen === undefined ? 'open' : chosen === optionIndex ? 'locked' : 'closed',
    })),
    locked: chosen !== undefined,
  };
}
