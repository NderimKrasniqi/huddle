import type { RelaySocket } from '@huddle/room-host';

import { hostedRoom } from './hosted-room';
import type { TvRoomClient } from './index';

type Browser = {
  readonly localStorage?: { getItem(key: string): string | null; setItem(key: string, value: string): void };
  readonly crypto: { getRandomValues<T extends Uint8Array>(array: T): T };
  readonly WebSocket: new (url: string) => RelaySocket;
};
const browser = globalThis as unknown as Browser;

// A browser cannot listen, so a web TV is reachable only through the relay.
export function webTvRoomClient(): TvRoomClient {
  const relayUrl = process.env.EXPO_PUBLIC_HUDDLE_RELAY_URL;
  const room = hostedRoom(
    {
      randomBytes: (count) => browser.crypto.getRandomValues(new Uint8Array(count)),
      read: (name) => {
        try {
          return browser.localStorage?.getItem(`huddle.${name}`) ?? undefined;
        } catch {
          return undefined;
        }
      },
      write: (name, text) => {
        try {
          browser.localStorage?.setItem(`huddle.${name}`, text);
        } catch {
          // Without storage the room still runs; it just does not survive a reload.
        }
      },
      openSocket: (url) => new browser.WebSocket(url),
    },
    relayUrl,
  );
  return room.client(async () => {
    const host = room.host();
    if (relayUrl === undefined || relayUrl === '') console.warn('Huddle web TV has no EXPO_PUBLIC_HUDDLE_RELAY_URL; no phone can reach it');
    room.startRelay();
    return host;
  });
}
