import type { GamePlayerId, GameSetupStage, PlayerRange } from '@huddle/contracts';

export const COUNTDOWN_MS = 5_000;

export type ReadinessSeat = {
  readonly playerId: GamePlayerId;
  readonly away: boolean;
};

export type ReadinessInput = {
  readonly stage: GameSetupStage;
  readonly seats: readonly ReadinessSeat[];
  readonly readyPlayerIds: readonly GamePlayerId[];
  readonly playerRange: PlayerRange | undefined;
};

export type Readiness = {
  readonly readyCount: number;
  readonly seatCount: number;
  readonly inRange: boolean;
  readonly allPresent: boolean;
  readonly allReady: boolean;
  readonly waitingPlayerIds: readonly GamePlayerId[];
  readonly complete: boolean;
};

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
