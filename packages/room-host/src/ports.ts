import type { HostSnapshot } from './state';

/** Cancels a timer set with `HostPorts.setTimer`. Calling it twice is harmless. */
export type CancelTimer = () => void;

/**
 * Everything the room host needs from the platform it runs on. The TV shell
 * passes React Native's timers, a crypto-backed random source and app storage;
 * the headless TV passes Node's. Nothing else in this package touches a clock,
 * randomness or storage.
 */
export type HostPorts = {
  /** Milliseconds since the epoch, by this device's clock. */
  readonly now: () => number;
  readonly setTimer: (afterMs: number, run: () => void) => CancelTimer;
  /**
   * A uniform number in [0, 1) from a cryptographic source. Room codes,
   * Session Tokens, ids and game seeds are all drawn from it.
   */
  readonly random: () => number;
  /** Called after every change with the room as it now stands. May debounce. */
  readonly save?: (snapshot: HostSnapshot) => void;
  /** Identifiers and a category only; never tokens, events or state. */
  readonly log?: (message: string, details: Readonly<Record<string, unknown>>) => void;
};
