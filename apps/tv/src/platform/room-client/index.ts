import type { ViewValue } from '@huddle/contracts/protocol';
import type { LanJoin, RunningGameResponse } from '@huddle/domain';

export type OpenRoom = {
  readonly roomId: string;
  readonly code: string;
  readonly restored: boolean;
  readonly hasRunningGame: boolean;
};

export type TvViewer = {
  readonly roomId: string;
  readonly tvSessionToken: string;
};

export type RosterSeat = ViewValue<'roster'>[number];
export type SeatArrival = ViewValue<'arrivals'>[number];

export type TvSetupView = {
  readonly gameId: string;
  readonly settings: Readonly<Record<string, string>>;
  readonly mode: 'quick' | 'standard' | 'custom';
  readonly stage: 'configuring' | 'ready' | 'countdown';
  readonly readyPlayerIds: readonly string[];
  readonly countdownEndsAt?: number;
};

export type TvViews = {
  readonly roster: readonly RosterSeat[];
  readonly running: RunningGameResponse;
  readonly browsing: number | null;
  readonly setup: TvSetupView | null;
  readonly arrivals: readonly SeatArrival[];
};

export type TvViewName = keyof TvViews;

export type TvRoomClient = {
  readonly deployed: boolean;
  readonly openRoom: (tvSessionToken: string) => Promise<OpenRoom>;
  readonly heartbeat: (tvSessionToken: string) => Promise<void>;
  readonly useView: <Name extends TvViewName>(name: Name, viewer: TvViewer | undefined) => TvViews[Name] | undefined;
  readonly useStillOpen: (roomId: string) => boolean | undefined;
  readonly useLanJoin: () => LanJoin | undefined;
};
