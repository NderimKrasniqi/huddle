import { type NativeModule, requireNativeModule } from 'expo';

import type { LanServerEvents } from './index';

declare class LanServerModule extends NativeModule<LanServerEvents> {
  start(port: number): Promise<number>;
  send(id: number, data: string): void;
  close(id: number): void;
  stop(): Promise<void>;
  addresses(): string[];
  /** TASK-04 spike: announce `Huddle-<code>` as a `_huddle._tcp` service. */
  advertise(code: string, port: number): Promise<string>;
  stopAdvertising(): void;
}

/** TASK-02 spike: the Kotlin WebSocket server in `modules/lan-server`. */
export const lanServer = requireNativeModule<LanServerModule>('LanServer');
export { LAN_SPIKE_PORT, type LanServerEvents } from './index';
