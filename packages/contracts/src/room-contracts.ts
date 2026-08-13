import type { GamePlayerId, GameSettings } from './game-module';

export const GAME_SETUP_MODES = ['quick', 'standard', 'custom'] as const;
export type GameSetupMode = (typeof GAME_SETUP_MODES)[number];
export type GameSetupStage = 'configuring' | 'ready';

export type RoomGameSetup = {
  readonly gameId: string;
  readonly mode: GameSetupMode;
  readonly settings: GameSettings;
  readonly stage: GameSetupStage;
  readonly readyPlayerIds: readonly GamePlayerId[];
};

export type GameLifecycleRejection =
  | { readonly kind: 'notInRoom' }
  | { readonly kind: 'notHost' }
  | { readonly kind: 'gameNotInstalled'; readonly gameId: string }
  | { readonly kind: 'alreadyInGame' }
  | { readonly kind: 'notEnoughPlayers'; readonly need: number; readonly have: number }
  | { readonly kind: 'tooManyPlayers'; readonly max: number; readonly have: number }
  | { readonly kind: 'settingRejected'; readonly key: string; readonly value: string }
  | { readonly kind: 'tvUnavailable' }
  | { readonly kind: 'setupNotReady' }
  | { readonly kind: 'playersNotReady'; readonly playerIds: GamePlayerId[] }
  | { readonly kind: 'playersAway'; readonly playerIds: GamePlayerId[] };

export type GameSetupRejection =
  | { readonly kind: 'setupNotFound' }
  | { readonly kind: 'setupAlreadyRunning' }
  | { readonly kind: 'setupLocked' }
  | { readonly kind: 'replayNotFinished' }
  | { readonly kind: 'replayNotAllowed' };

export type RateLimitOperation =
  | 'roomOpen'
  | 'joinRoom'
  | 'memberCommand'
  | 'hostCommand'
  | 'tvCommand'
  | 'gameEvent';

export type RateLimitRejection = {
  readonly kind: 'rateLimited';
  readonly operation: RateLimitOperation;
  readonly retryAfterMs: number;
};

export type RunningGame<State = unknown> = {
  readonly gameId: string;
  readonly state: State;
  readonly settings?: GameSettings;
  readonly mode?: GameSetupMode;
};

export type RunningGameResponse =
  | null
  | {
      readonly kind: 'running';
      readonly gameId: string;
      readonly state: unknown;
      readonly settings?: GameSettings;
      readonly mode?: GameSetupMode;
      readonly clockRemainingMs?: number;
    }
  | { readonly kind: 'paused'; readonly gameId: string; readonly reason: 'tvDisconnected' | 'playerDisconnected' }
  | { readonly kind: 'unavailable'; readonly gameId: string };
