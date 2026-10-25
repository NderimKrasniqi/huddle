import { type NativeModule, requireNativeModule } from 'expo';

import type { LanServer, LanServerEvents } from './index';

declare class LanServerModule extends NativeModule<LanServerEvents> implements LanServer {
  start(port: number): Promise<number>;
  send(id: number, data: string): void;
  close(id: number): void;
  stop(): Promise<void>;
  addresses(): string[];
  advertise(code: string, port: number): Promise<string>;
  stopAdvertising(): void;
}

/** The native server in `modules/lan-server`: Java-WebSocket on Android TV, Network.framework on Apple TV. */
export const lanServer = requireNativeModule<LanServerModule>('LanServer');
export { LAN_PORT, type LanServer, type LanServerEvents } from './index';
