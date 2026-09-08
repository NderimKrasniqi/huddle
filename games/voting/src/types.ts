import type { GameEvent, GamePlayerId } from '@huddle/domain';

import type { ResultMode, VoteSeconds, VoterLabelMode } from './settings';

export type VotingPrompt = {
  readonly text: string;
  readonly options: readonly [string, string, string, string];
};

export type VotingPhase = 'intro' | 'vote' | 'reveal' | 'finished';

export type VotingRoundResult = {
  readonly promptIndex: number;
  readonly counts: readonly [number, number, number, number];
};

export type VotingRecapItem = {
  readonly kind: 'agreement' | 'closest' | 'wildcard';
  readonly title: string;
  readonly detail: string;
  readonly value: string;
};

export type LegacyVotingState = {
  readonly phase: 'entered';
  readonly resolvedSettings: { readonly rounds: 3 | 5 };
};

export type PlayableVotingState = {
  readonly prompts: readonly VotingPrompt[];
  readonly roundIndex: number;
  readonly phase: VotingPhase;
  readonly voteSeconds: VoteSeconds;
  readonly results: ResultMode;
  readonly voterLabels: VoterLabelMode;
  readonly playerIds: readonly GamePlayerId[];
  readonly votes: Readonly<Record<GamePlayerId, number>>;
  readonly history: readonly VotingRoundResult[];
  /** TV-only normalized participation projection. Never stored. */
  readonly participationCount?: number;
  /** TV-only aggregate counts. Never contains a player-to-choice mapping. */
  readonly tally?: readonly [number, number, number, number];
  /** TV reveal-only player ids grouped by choice when the Host enabled labels. */
  readonly revealedVoters?: readonly (readonly GamePlayerId[])[];
  /** TV finished-only aggregate room-vibe summary. */
  readonly recap?: readonly VotingRecapItem[];
};

export type VotingState = LegacyVotingState | PlayableVotingState;

export type VotingEvent =
  | (GameEvent & {
      readonly kind: 'vote';
      readonly playerId: GamePlayerId;
      readonly roundIndex: number;
      readonly optionIndex: number;
    })
  | (GameEvent & {
      readonly kind: 'advance';
      readonly roundIndex: number;
      readonly phase: VotingPhase;
    });

export type VotingAdvance = Extract<VotingEvent, { kind: 'advance' }>;

export function isPlayableVotingState(state: VotingState): state is PlayableVotingState {
  return state.phase !== 'entered';
}
