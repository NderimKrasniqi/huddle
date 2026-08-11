import type { GamePlayerId } from '@huddle/game-core';

import type { VotingPrompt } from './prompts';

export type VotingPhase = 'voting' | 'reveal' | 'finished';

export type VotingState = {
  readonly prompts: readonly VotingPrompt[];
  readonly promptIndex: number;
  readonly phase: VotingPhase;
  readonly voters: readonly GamePlayerId[];
  readonly tally: readonly number[];
  readonly players: readonly GamePlayerId[];
};

export type VotingEvent =
  | {
      readonly kind: 'vote';
      readonly playerId: GamePlayerId;
      readonly promptIndex: number;
      readonly optionIndex: number;
      readonly awayPlayerIds?: readonly GamePlayerId[];
    }
  | {
      readonly kind: 'advance';
      readonly playerId?: GamePlayerId;
      readonly promptIndex: number;
      readonly phase: VotingPhase;
      readonly msRemaining?: number;
      readonly awayPlayerIds?: readonly GamePlayerId[];
    };

export type VotingAdvance = Extract<VotingEvent, { kind: 'advance' }>;
