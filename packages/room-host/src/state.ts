import type { AvatarId, GameSettings, GameSetupMode, GameSetupStage } from '@huddle/domain';

export type Seat = {
  readonly playerId: string;
  readonly nickname: string;
  readonly sessionToken: string;
  lastSeenAt: number;
  away: boolean;
  readonly avatar: AvatarId;
  readonly guestId?: string;
};

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
  readonly countdownEndsAt?: number;
};

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
  tvAway: boolean;
  tvAwaySince?: number;
  seats: Seat[];
  previews: SeatPreview[];
};

export const SNAPSHOT_VERSION = 1;

export type HostSnapshot = {
  readonly version: typeof SNAPSHOT_VERSION;
  readonly tvInstanceId: string;
  readonly savedAt: number;
  readonly room: RoomState;
};
