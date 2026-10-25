import type { GameEvent, GamePlayerId } from '@huddle/domain';

export type Point = { readonly x: number; readonly y: number };

export type Blob = Point & { readonly alive: boolean };

export type Aim = { readonly dx: number; readonly dy: number };

export type SumoPhase = 'howTo' | 'aim' | 'replay' | 'matchOver' | 'finished';

export type RoundReplay = {
  readonly start: Readonly<Record<GamePlayerId, Point>>;
  readonly aims: Readonly<Record<GamePlayerId, Aim>>;
  readonly final: Readonly<Record<GamePlayerId, Point>>;
  readonly arenaRadius: number;
  readonly knockedOut: readonly GamePlayerId[];
  readonly knockouts: readonly Knockout[];
};

export type Knockout = { readonly out: GamePlayerId; readonly by?: GamePlayerId; readonly byGhost: boolean };

export type SumoState = {
  readonly phase: SumoPhase;
  readonly match: number;
  readonly matchCount: number;
  readonly round: number;
  readonly arenaRadius: number;
  readonly aimSeconds: number;
  readonly blobs: Readonly<Record<GamePlayerId, Blob>>;
  readonly aims: Readonly<Record<GamePlayerId, Aim>>;
  readonly lastRound?: RoundReplay;
  readonly matchWinners: readonly (GamePlayerId | null)[];
  readonly standings: readonly { readonly playerId: GamePlayerId; readonly score: number }[];
  readonly gotIt?: readonly GamePlayerId[];
  readonly aimedCount?: number;
};

type SumoAim = GameEvent & { readonly kind: 'aim'; readonly match: number; readonly round: number; readonly dx: number; readonly dy: number };
type SumoGotIt = GameEvent & { readonly kind: 'gotIt' };
export type SumoAdvance = GameEvent & { readonly kind: 'advance'; readonly match: number; readonly round: number; readonly phase: SumoPhase };
export type SumoEvent = SumoAim | SumoGotIt | SumoAdvance;
