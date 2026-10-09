import type { GameEvent, GamePlayerId } from '@huddle/domain';

/** The four wires, left to right on the bomb. */
export const WIRES = ['red', 'blue', 'yellow', 'green'] as const;
export type Wire = (typeof WIRES)[number];

/**
 * One private hint about the safe wire. Stored as data, not words, so the
 * rules can check whether it is true and each screen can phrase it.
 */
export type Clue =
  | { readonly kind: 'not'; readonly wire: Wire }
  | { readonly kind: 'tone'; readonly tone: 'warm' | 'cool' }
  | { readonly kind: 'side'; readonly side: 'left' | 'right' }
  | { readonly kind: 'nextTo'; readonly wire: Wire };

/** One round's secret deal: the safe wire, who is lying, and every clue. */
export type RoundDeal = {
  /** Absent only in a redacted copy, for a viewer not entitled to know it yet. */
  readonly safe?: Wire;
  readonly saboteurs: readonly GamePlayerId[];
  readonly clues: Readonly<Record<GamePlayerId, Clue>>;
};

type BombPhase = 'howTo' | 'brief' | 'debate' | 'reveal' | 'finished';

/** How a round ended, once the wire is cut. */
export type RoundResult = {
  /** The wire the room cut, or null when votes tied or nobody voted. */
  readonly cut: Wire | null;
  readonly defused: boolean;
  readonly gains: Readonly<Record<GamePlayerId, number>>;
};

type BombStanding = { readonly playerId: GamePlayerId; readonly score: number };

export type BombState = {
  readonly phase: BombPhase;
  readonly round: number;
  /**
   * Every round, dealt at the start from the server's seed (the rules may not
   * draw random numbers). Secret: `redactBombStateFor` hides every round but
   * the viewer's own part of the current one, and a round's whole deal only
   * once it has been revealed.
   */
  readonly rounds: readonly RoundDeal[];
  /** How many rounds the game has; a redacted copy drops the rounds still to come. */
  readonly roundCount: number;
  readonly votes: Readonly<Record<GamePlayerId, Wire>>;
  readonly debateSeconds: number;
  readonly standings: readonly BombStanding[];
  readonly results: readonly RoundResult[];
  /** TV-safe live count of votes cast; never which wire. */
  readonly votedCount?: number;
};

type BombVote = GameEvent & { readonly kind: 'vote'; readonly round: number; readonly wire: Wire };
export type BombAdvance = GameEvent & { readonly kind: 'advance'; readonly round: number; readonly phase: BombPhase };
export type BombEvent = BombVote | BombAdvance;
