import type { ViewValue } from '@huddle/contracts/protocol';
import type { RunningGameResponse } from '@huddle/domain';

/**
 * How the TV reaches its room, whatever holds it. Today the Convex
 * implementation backs it; the room host running inside the TV app replaces
 * it (TASK-12). Screens never name a backend.
 */

/** The room this TV opened: its id, its Room Code, and whether it was picked back up. */
export type OpenRoom = {
  readonly roomId: string;
  readonly code: string;
  readonly restored: boolean;
  readonly hasRunningGame: boolean;
};

/** What proves this launch is the room's TV. A host inside the TV app ignores it. */
export type TvViewer = {
  readonly roomId: string;
  readonly tvSessionToken: string;
};

export type RosterSeat = ViewValue<'roster'>[number];
export type SeatArrival = ViewValue<'arrivals'>[number];

/** The setup draft as the TV draws it; the countdown's end is on this TV's clock. */
export type TvSetupView = {
  readonly gameId: string;
  readonly settings: Readonly<Record<string, string>>;
  readonly mode: 'quick' | 'standard' | 'custom';
  readonly stage: 'configuring' | 'ready' | 'countdown';
  readonly readyPlayerIds: readonly string[];
  readonly countdownEndsAt?: number;
};

/** Every live view of the TV. `undefined` from a hook means not loaded yet. */
export type TvViews = {
  readonly roster: readonly RosterSeat[];
  readonly running: RunningGameResponse;
  readonly browsing: number | null;
  readonly setup: TvSetupView | null;
  readonly arrivals: readonly SeatArrival[];
};

export type TvViewName = keyof TvViews;

export type TvRoomClient = {
  /** Whether this build has a room service to open a room on at all. */
  readonly deployed: boolean;
  /** Opens this TV's room, or picks back up the one its credential already holds. */
  readonly openRoom: (tvSessionToken: string) => Promise<OpenRoom>;
  /** "Still here" for the TV's own presence. */
  readonly heartbeat: (tvSessionToken: string) => Promise<void>;
  /** A live view as the room's TV; `undefined` until it loads, without a viewer, or when skipped. */
  readonly useView: <Name extends TvViewName>(name: Name, viewer: TvViewer | undefined) => TvViews[Name] | undefined;
  /** `false` once the room the TV shows has ended. */
  readonly useStillOpen: (roomId: string) => boolean | undefined;
};
