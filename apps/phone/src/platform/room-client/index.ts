import type { CommandArgs, CommandName, CommandResult, ViewValue } from '@huddle/contracts/protocol';
import type { RunningGameResponse } from '@huddle/domain';

/**
 * How the phone talks to its room, whatever carries it. Today the Convex
 * implementation backs it; the LAN client to the TV's room host replaces it
 * (TASK-13). Screens and features never name a transport.
 */

/** What proves a seat: the room it is in and the Session Token it holds. */
export type SeatCredential = {
  readonly roomId: string;
  readonly sessionToken: string;
};

export type PlayerSession = NonNullable<ViewValue<'session'>>;
export type RosterSeat = ViewValue<'roster'>[number];
export type JoinedSeat = CommandResult<'joinRoom'>;
export type JoinAvailability = CommandResult<'joinAvailability'>;

/**
 * The setup draft as screens use it. The countdown's end is an absolute time
 * on this phone's clock, which each implementation works out on arrival.
 */
export type SetupView = {
  readonly gameId: string;
  readonly settings: Readonly<Record<string, string>>;
  readonly mode: 'quick' | 'standard' | 'custom';
  readonly stage: 'configuring' | 'ready' | 'countdown';
  readonly readyPlayerIds: readonly string[];
  readonly countdownEndsAt?: number;
};

/** Every live view of a seated phone. `undefined` from a hook means not loaded yet. */
export type RoomViews = {
  readonly session: PlayerSession | null;
  readonly roster: readonly RosterSeat[];
  readonly setup: SetupView | null;
  readonly browsing: number | null;
  readonly running: RunningGameResponse;
};

export type RoomViewName = keyof RoomViews;

/** Commands a seat sends; the seat itself comes from the credential. */
export type SeatCommandName = Exclude<
  CommandName,
  'joinAvailability' | 'previewSeat' | 'clearSeatPreview' | 'joinRoom' | 'resumeSession'
>;

export type RoomClient = {
  /** A live view as `seat` may see it; `undefined` until it loads or without a seat. */
  readonly useView: <Name extends RoomViewName>(name: Name, seat: SeatCredential | undefined) => RoomViews[Name] | undefined;
  /** Capacity and claimed avatars for a four-letter code; `null` for no such room. */
  readonly useJoinAvailability: (code: string | undefined) => JoinAvailability | undefined;
  /** Rejects with `RoomRefusal` when the room refuses. */
  readonly command: <Name extends SeatCommandName>(name: Name, seat: SeatCredential, args: CommandArgs<Name>) => Promise<void>;
  readonly joinRoom: (args: CommandArgs<'joinRoom'>) => Promise<JoinedSeat>;
  /** The seat a saved Session Token still holds, or `null`. */
  readonly lookupSession: (sessionToken: string) => Promise<PlayerSession | null>;
  readonly previewSeat: (args: CommandArgs<'previewSeat'>) => Promise<void>;
  readonly clearSeatPreview: (previewKey: string) => Promise<void>;
  /** "Still here" while the app is in front of its owner. */
  readonly heartbeat: (sessionToken: string) => Promise<void>;
};
