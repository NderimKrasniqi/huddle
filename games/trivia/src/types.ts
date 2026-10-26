import type { GamePlayerId } from '@huddle/domain';

import type { TriviaQuestion } from './questions';
import type { QuestionSeconds, ScoringMode } from './settings';

export type TriviaPhase = 'intro' | 'question' | 'reveal' | 'finished';

export type TriviaStanding = {
  readonly playerId: GamePlayerId;
  readonly score: number;
};

export type TriviaState = {
  readonly questions: readonly TriviaQuestion[];
  readonly questionIndex: number;
  readonly questionSeconds?: QuestionSeconds;
  readonly phase: TriviaPhase;
  readonly answers: Readonly<Record<GamePlayerId, number>>;
  readonly answerSeconds?: Readonly<Record<GamePlayerId, number>>;
  readonly participationCount?: number;
  readonly revealVerdicts?: Readonly<Record<GamePlayerId, boolean>>;
  readonly revealAnswered?: Readonly<Record<GamePlayerId, boolean>>;
  readonly revealGains?: Readonly<Record<GamePlayerId, number>>;
  readonly standings: readonly TriviaStanding[];
  readonly scoring?: ScoringMode;
};

export type TriviaEvent =
  | {
      readonly kind: 'answer';
      readonly playerId: GamePlayerId;
      readonly questionIndex: number;
      readonly optionIndex: number;
      readonly msRemaining?: number;
      readonly awayPlayerIds?: readonly GamePlayerId[];
      readonly fromHost?: boolean;
    }
  | {
      readonly kind: 'advance';
      readonly playerId?: GamePlayerId;
      readonly questionIndex: number;
      readonly phase: TriviaPhase;
      readonly msRemaining?: number;
      readonly awayPlayerIds?: readonly GamePlayerId[];
      readonly fromHost?: boolean;
    };

export type TriviaAdvance = Extract<TriviaEvent, { kind: 'advance' }>;
