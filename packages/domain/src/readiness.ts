import type { GamePlayerId, GameSetupStage, PlayerRange } from '@huddle/contracts';

/**
 * How long the room counts down between everyone being Ready and the game
 * starting. The server schedules the start this far ahead; the clients only
 * draw what is left of it.
 */
export const COUNTDOWN_MS = 5_000;

/** A seat as the ready check needs it: who, and whether the room still hears them. */
export type ReadinessSeat = {
  readonly playerId: GamePlayerId;
  readonly away: boolean;
};

export type ReadinessInput = {
  readonly stage: GameSetupStage;
  readonly seats: readonly ReadinessSeat[];
  readonly readyPlayerIds: readonly GamePlayerId[];
  /** Absent when no installed game declares one, which fails closed. */
  readonly playerRange: PlayerRange | undefined;
};

export type Readiness = {
  /** Present seats that are Ready. An away seat is never counted as ready. */
  readonly readyCount: number;
  readonly seatCount: number;
  /** The seat count is inside the game's declared range. */
  readonly inRange: boolean;
  /** Nobody seated is away. */
  readonly allPresent: boolean;
  /** Every seat, away or not, has marked itself Ready. */
  readonly allReady: boolean;
  /** Seats that still have to press Ready, in roster order. */
  readonly waitingPlayerIds: readonly GamePlayerId[];
  /**
   * The ready check is complete: the setup is locked (or already counting
   * down), the party fits the game, nobody is away, and everybody is Ready.
   * This is the one gate that starts the countdown, keeps it running, and
   * lets the game begin when it ends.
   */
  readonly complete: boolean;
};

/**
 * The ready-check rule, shared by the server that enforces it and the Phone
 * and TV that preview it. A client preview never replaces the server's
 * answer; it only keeps every screen telling the same story while it waits.
 */
export function readiness({ stage, seats, readyPlayerIds, playerRange }: ReadinessInput): Readiness {
  const ready = new Set(readyPlayerIds.map(String));
  const isReady = (seat: ReadinessSeat) => ready.has(String(seat.playerId));
  const inRange = playerRange !== undefined
    && seats.length >= playerRange.min
    && seats.length <= playerRange.max;
  const allPresent = seats.every((seat) => !seat.away);
  const allReady = seats.length > 0 && seats.every(isReady);
  const locked = stage === 'ready' || stage === 'countdown';

  return {
    readyCount: seats.filter((seat) => !seat.away && isReady(seat)).length,
    seatCount: seats.length,
    inRange,
    allPresent,
    allReady,
    waitingPlayerIds: seats.filter((seat) => !isReady(seat)).map((seat) => seat.playerId),
    complete: locked && inRange && allPresent && allReady,
  };
}
