import type { CommandArgs, CommandName, CommandResult, ViewValue } from '@huddle/contracts/protocol';
import type { LanJoin, RunningGameResponse } from '@huddle/domain';

export type SeatCredential = {
  readonly roomId: string;
  readonly sessionToken: string;
};

export type PlayerSession = NonNullable<ViewValue<'session'>>;
export type RosterSeat = ViewValue<'roster'>[number];
export type JoinedSeat = CommandResult<'joinRoom'>;
export type JoinAvailability = CommandResult<'joinAvailability'>;

export type SetupView = {
  readonly gameId: string;
  readonly settings: Readonly<Record<string, string>>;
  readonly mode: 'quick' | 'standard' | 'custom';
  readonly stage: 'configuring' | 'ready' | 'countdown';
  readonly readyPlayerIds: readonly string[];
  readonly countdownEndsAt?: number;
};

export type RoomViews = {
  readonly session: PlayerSession | null;
  readonly roster: readonly RosterSeat[];
  readonly setup: SetupView | null;
  readonly browsing: number | null;
  readonly running: RunningGameResponse;
};

export type RoomViewName = keyof RoomViews;

export type ConnectionProblem = 'localNetworkDenied' | 'unreachable' | 'incompatible';

export type SeatCommandName = Exclude<
  CommandName,
  'joinAvailability' | 'previewSeat' | 'clearSeatPreview' | 'joinRoom' | 'resumeSession'
>;

export type RoomClient = {
  readonly useView: <Name extends RoomViewName>(name: Name, seat: SeatCredential | undefined) => RoomViews[Name] | undefined;
  readonly useJoinAvailability: (code: string | undefined) => JoinAvailability | undefined;
  readonly command: <Name extends SeatCommandName>(name: Name, seat: SeatCredential, args: CommandArgs<Name>) => Promise<void>;
  readonly joinRoom: (args: CommandArgs<'joinRoom'>) => Promise<JoinedSeat>;
  readonly lookupSession: (sessionToken: string) => Promise<PlayerSession | null>;
  readonly previewSeat: (args: CommandArgs<'previewSeat'>) => Promise<void>;
  readonly clearSeatPreview: (previewKey: string) => Promise<void>;
  readonly heartbeat: (sessionToken: string) => Promise<void>;
  readonly rememberTv?: (code: string, lan: LanJoin) => void;
  readonly useConnectionProblem: () => ConnectionProblem | undefined;
  readonly retryConnection: () => void;
};
