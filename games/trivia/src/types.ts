import type { GamePlayerId } from '@huddle/domain';

import type { TriviaQuestion } from './questions';
import type { QuestionSeconds, ScoringMode } from './settings';

export type TriviaPhase = 'intro' | 'question' | 'reveal' | 'finished';

export type TriviaStanding = {
  readonly playerId: GamePlayerId;
  readonly score: number;
};

export type LegacyTriviaState = {
  readonly phase: 'entered';
  readonly resolvedSettings: { readonly questions: 5 | 10 };
};

export type PlayableTriviaState = {
  readonly questions: readonly TriviaQuestion[];
  readonly questionIndex: number;
  readonly questionSeconds?: QuestionSeconds;
  readonly phase: TriviaPhase;
  readonly answers: Readonly<Record<GamePlayerId, number>>;
  readonly answerSeconds?: Readonly<Record<GamePlayerId, number>>;
  /**
   * TV-only live-question projection. The stored game and Phone projections do
   * not carry this field; it is derived at the public query boundary so the TV
   * can show an aggregate without learning which player answered or when.
   */
  readonly participationCount?: number;
  /**
   * TV-only reveal projection. The stored game never needs this field: it is
   * derived from the unredacted answers at the public query boundary so the TV
   * can show shared outcomes without receiving anybody's option mapping.
   */
  readonly revealVerdicts?: Readonly<Record<GamePlayerId, boolean>>;
  readonly standings: readonly TriviaStanding[];
  readonly scoring?: ScoringMode;
};

/** v2 keeps the original launch-proof state readable beside playable Trivia. */
export type TriviaState = LegacyTriviaState | PlayableTriviaState;

export type TriviaEvent =
  | {
      readonly kind: 'answer';
      readonly playerId: GamePlayerId;
      readonly questionIndex: number;
      readonly optionIndex: number;
      readonly msRemaining?: number;
      readonly awayPlayerIds?: readonly GamePlayerId[];
    }
  | {
      readonly kind: 'advance';
      readonly playerId?: GamePlayerId;
      readonly questionIndex: number;
      readonly phase: TriviaPhase;
      readonly msRemaining?: number;
      readonly awayPlayerIds?: readonly GamePlayerId[];
    };

export type TriviaAdvance = Extract<TriviaEvent, { kind: 'advance' }>;

export function isPlayableTriviaState(state: TriviaState): state is PlayableTriviaState {
  return state.phase !== 'entered';
}
