import type { HostSnapshot } from './state';

export type CancelTimer = () => void;

export type HostPorts = {
  readonly now: () => number;
  readonly setTimer: (afterMs: number, run: () => void) => CancelTimer;
  readonly random: () => number;
  readonly save?: (snapshot: HostSnapshot) => void;
  readonly log?: (message: string, details: Readonly<Record<string, unknown>>) => void;
};
