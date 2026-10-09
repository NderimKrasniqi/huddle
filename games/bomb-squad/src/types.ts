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
  /** The four wires in a seeded order: a tied vote cuts the tied wire that comes first. */
  readonly tieOrder?: readonly Wire[];
};

/**
 * One round runs brief → debate → cut (the wire and the votes) → accuse (who
 * lied?) → reveal (the saboteurs and the points).
 */
type BombPhase = 'howTo' | 'brief' | 'debate' | 'cut' | 'accuse' | 'reveal' | 'finished';

/** How a round ended, once the wire is cut. */
export type RoundResult = {
  /** The wire the room cut, or null when nobody voted. */
  readonly cut: Wire | null;
  /** Whether the top votes tied, so the bomb's own order picked the wire. */
  readonly tied?: boolean;
  readonly defused: boolean;
  /** Each player's points for the round; empty until the reveal, so it cannot give a saboteur away. */
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
  /** Players who tapped "Got it" on the rules; the first bomb starts once everyone here has. */
  readonly gotIt?: readonly GamePlayerId[];
  /** Who each player named as the saboteur this round; private until the reveal. */
  readonly accusations: Readonly<Record<GamePlayerId, GamePlayerId>>;
  readonly debateSeconds: number;
  readonly standings: readonly BombStanding[];
  readonly results: readonly RoundResult[];
  /** TV-safe live count of wire votes (debate) or accusations (accuse); never whose. */
  readonly votedCount?: number;
};

type BombVote = GameEvent & { readonly kind: 'vote'; readonly round: number; readonly wire: Wire };
export type BombAdvance = GameEvent & { readonly kind: 'advance'; readonly round: number; readonly phase: BombPhase };
type BombAccuse = GameEvent & { readonly kind: 'accuse'; readonly round: number; readonly suspect: GamePlayerId };
type BombGotIt = GameEvent & { readonly kind: 'gotIt' };
export type BombEvent = BombVote | BombAccuse | BombGotIt | BombAdvance;
