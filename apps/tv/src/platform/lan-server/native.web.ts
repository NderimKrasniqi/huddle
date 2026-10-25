import type { LanServer } from './index';

/**
 * A browser cannot accept connections, so a web TV has no LAN server. Only
 * the LAN spike screen reaches this; the web room client hosts through the
 * relay instead.
 */
const unavailable = () => Promise.reject(new Error('A web TV cannot run a LAN server'));

export const lanServer: LanServer & { addListener: (...args: unknown[]) => { remove: () => void } } = {
  start: unavailable,
  send: () => {},
  close: () => {},
  stop: async () => {},
  addresses: () => [],
  advertise: unavailable,
  stopAdvertising: () => {},
  addListener: () => ({ remove: () => {} }),
};
export { LAN_PORT, type LanServer, type LanServerEvents } from './index';
