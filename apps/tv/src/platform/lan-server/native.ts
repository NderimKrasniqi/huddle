import { type NativeModule, requireNativeModule } from 'expo';

import type { LanServerEvents } from './index';

declare class LanServerModule extends NativeModule<LanServerEvents> {
  start(port: number): Promise<number>;
  send(id: number, data: string): void;
  close(id: number): void;
  stop(): Promise<void>;
  addresses(): string[];
}

/** TASK-02 spike: the Kotlin WebSocket server in `modules/lan-server`. */
export const lanServer = requireNativeModule<LanServerModule>('LanServer');
export { LAN_SPIKE_PORT, type LanServerEvents } from './index';
