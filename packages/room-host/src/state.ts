import type { AvatarId, GameSettings, GameSetupMode, GameSetupStage } from '@huddle/domain';

/** One phone's place in the room. `sessionToken` never leaves the host. */
export type Seat = {
  readonly playerId: string;
  readonly nickname: string;
  readonly sessionToken: string;
  /** The last frame the room heard from this phone, by the host clock. */
  lastSeenAt: number;
  away: boolean;
  readonly avatar: AvatarId;
  readonly guestId?: string;
};

/** Someone on the join form; never a seat or a reservation. */
export type SeatPreview = {
  readonly previewId: string;
  readonly previewKey: string;
  nickname: string;
  avatar: AvatarId;
  updatedAt: number;
};

export type Setup = {
  readonly gameId: string;
  readonly settings: GameSettings;
  readonly mode: GameSetupMode;
  readonly stage: GameSetupStage;
  readonly readyPlayerIds: readonly string[];
  /** While `stage` is `countdown`: when the start is due, by the host clock. */
  readonly countdownEndsAt?: number;
};

/**
 * The running game. `state` is the module's own, kept as its decoder last
 * returned it. A beat with a deadline holds `deadlineAt` and the event the
 * deadline raises; a paused one holds `pausedRemainingMs` instead.
 */
export type StoredGame = {
  readonly gameId: string;
  readonly stateVersion: number;
  readonly state: unknown;
  readonly settings?: GameSettings;
  readonly mode?: GameSetupMode;
  readonly deadlineAt?: number;
  readonly deadlineBeat?: string;
  readonly deadlineEvent?: unknown;
  readonly pausedRemainingMs?: number;
  readonly playerPaused?: true;
};

export type RoomState = {
  readonly roomId: string;
  readonly code: string;
  hostPlayerId?: string;
  setup?: Setup;
  game?: StoredGame;
  browsingGameIndex?: number;
  /** The TV app is in the background; the game holds and the countdown stops. */
  tvAway: boolean;
  tvAwaySince?: number;
  /** In join order, which is the order the TV's seats fill. */
  seats: Seat[];
  previews: SeatPreview[];
};

export const SNAPSHOT_VERSION = 1;

/** The whole room, JSON-safe, as `HostPorts.save` receives it. */
export type HostSnapshot = {
  readonly version: typeof SNAPSHOT_VERSION;
  readonly tvInstanceId: string;
  readonly savedAt: number;
  readonly room: RoomState;
};
