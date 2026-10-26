import type { GameEvent, GamePlayerId } from '@huddle/domain';

export const WIRES = ['red', 'blue', 'yellow', 'green'] as const;
export type Wire = (typeof WIRES)[number];

export type Clue =
  | { readonly kind: 'not'; readonly wire: Wire }
  | { readonly kind: 'tone'; readonly tone: 'warm' | 'cool' }
  | { readonly kind: 'side'; readonly side: 'left' | 'right' }
  | { readonly kind: 'nextTo'; readonly wire: Wire };

export type RoundDeal = {
  readonly safe?: Wire;
  readonly saboteurs: readonly GamePlayerId[];
  readonly clues: Readonly<Record<GamePlayerId, Clue>>;
  readonly tieOrder?: readonly Wire[];
};

type BombPhase = 'howTo' | 'brief' | 'debate' | 'cut' | 'accuse' | 'reveal' | 'finished';

export type RoundResult = {
  readonly cut: Wire | null;
  readonly tied?: boolean;
  readonly defused: boolean;
  readonly gains: Readonly<Record<GamePlayerId, number>>;
};

type BombStanding = { readonly playerId: GamePlayerId; readonly score: number };

export type BombState = {
  readonly phase: BombPhase;
  readonly round: number;
  readonly rounds: readonly RoundDeal[];
  readonly roundCount: number;
  readonly votes: Readonly<Record<GamePlayerId, Wire>>;
  readonly gotIt?: readonly GamePlayerId[];
  readonly accusations: Readonly<Record<GamePlayerId, GamePlayerId>>;
  readonly debateSeconds: number;
  readonly standings: readonly BombStanding[];
  readonly results: readonly RoundResult[];
  readonly votedCount?: number;
};

type BombVote = GameEvent & { readonly kind: 'vote'; readonly round: number; readonly wire: Wire };
export type BombAdvance = GameEvent & { readonly kind: 'advance'; readonly round: number; readonly phase: BombPhase };
type BombAccuse = GameEvent & { readonly kind: 'accuse'; readonly round: number; readonly suspect: GamePlayerId };
type BombGotIt = GameEvent & { readonly kind: 'gotIt' };
export type BombEvent = BombVote | BombAccuse | BombGotIt | BombAdvance;
