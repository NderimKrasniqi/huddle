import type {
  GameLifecycleRejection,
  PlayerRange,
  RoomGameSetup,
  RunningGame,
} from '@huddle/contracts';

export type RoomSetup = RoomGameSetup;

export const ROOM_PHASES = ['lobby', 'configuring', 'in-game'] as const;

export type RoomPhase = (typeof ROOM_PHASES)[number];

export function roomPhase(
  game: RunningGame | undefined | null,
  setup?: Pick<RoomSetup, 'gameId'> | null,
): RoomPhase {
  if (game !== undefined && game !== null) return 'in-game';
  return setup === undefined || setup === null ? 'lobby' : 'configuring';
}

export type GameLifecycleIntent = 'start' | 'end';

export function phaseAfter(intent: GameLifecycleIntent): RoomPhase {
  return intent === 'start' ? 'in-game' : 'lobby';
}

export function refusalToStart(
  phase: RoomPhase,
  seatedPlayers: number,
  playerRange: PlayerRange,
): GameLifecycleRejection | null {
  if (phase === 'in-game') {
    return { kind: 'alreadyInGame' };
  }

  if (seatedPlayers < playerRange.min) {
    return { kind: 'notEnoughPlayers', need: playerRange.min, have: seatedPlayers };
  }

  if (seatedPlayers > playerRange.max) {
    return { kind: 'tooManyPlayers', max: playerRange.max, have: seatedPlayers };
  }

  return null;
}
