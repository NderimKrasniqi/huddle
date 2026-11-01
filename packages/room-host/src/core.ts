import type { CommandArgs, CommandName, CommandResult, ViewName } from '@huddle/contracts/protocol';
import type { GameEvent, GameLogic, GamePlayer, GameSettings, GameSetupMode } from '@huddle/domain';

import type { HostPorts } from './ports';
import type { RateLimiter } from './rate-limits';
import type { RoomState, Seat, StoredGame } from './state';

export type Connection = {
  readonly id: number;
  readonly send: (frame: string) => void;
  readonly close: () => void;
  greeted: boolean;
  playerId?: string;
  lastFrameAt: number;
  watchingAvailability?: boolean;
  readonly sent: Map<ViewName, string>;
};

export type StartArgs = {
  readonly gameId?: string;
  readonly settings?: Record<string, string>;
  readonly mode?: GameSetupMode;
};

export type CommandTable = {
  readonly [Name in CommandName]: (connection: Connection, args: CommandArgs<Name>) => CommandResult<Name>;
};

// What the command handlers may use of the room host.
export type HostCore = {
  readonly room: RoomState;
  readonly ports: HostPorts;
  readonly limiter: RateLimiter;
  readonly newId: (prefix: string) => string;
  readonly bind: (connection: Connection, playerId: string) => void;
  readonly touch: (seat: Seat) => void;
  readonly beating: (seat: Seat) => boolean;
  readonly needsHost: () => boolean;
  readonly requireSeat: (connection: Connection) => Seat;
  readonly requireHost: (connection: Connection, limit: 'hostCommand') => Seat;
  readonly targetSeat: (actor: Seat, playerId: string) => Seat;
  readonly handOverRoom: (departing: Seat, departingIsLeaving: boolean) => void;
  readonly unseatConnections: (playerId: string, reason: 'removed' | undefined) => void;
  readonly dropReady: (playerId: string) => void;
  readonly resumeWhenEveryoneReturns: () => void;
  readonly reconcileCountdown: () => void;
  readonly armCountdown: (endsAt: number, afterMs: number) => void;
  readonly cancelCountdownTimer: () => void;
  readonly validatedStart: (args: StartArgs) => { game: GameLogic; players: GamePlayer[]; requestedSettings: GameSettings | undefined };
  readonly startFromSetup: (args: StartArgs) => void;
  readonly stopGameClock: () => void;
  readonly resumePausedGameClock: (running: StoredGame) => StoredGame;
  readonly playGameEvent: (event: GameEvent) => void;
};
