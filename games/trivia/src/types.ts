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
   * Reveal projection. The stored game never needs this field: it is derived
   * from the unredacted answers at the public query boundary. The TV gets every
   * player's outcome; a phone gets only its owner's, never anybody's option.
   */
  readonly revealVerdicts?: Readonly<Record<GamePlayerId, boolean>>;
  /**
   * Reveal projection: whether each player answered the question at all, so a
   * phone can tell "out of time" from "wrong". Phone-only, and only its
   * owner's: the TV draws right or wrong and needs nothing more.
   */
  readonly revealAnswered?: Readonly<Record<GamePlayerId, boolean>>;
  /** TV-only reveal projection: each player's points on the question just revealed. */
  readonly revealGains?: Readonly<Record<GamePlayerId, number>>;
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

export function isPlayableTriviaState(state: TriviaState): state is PlayableTriviaState {
  return state.phase !== 'entered';
}
