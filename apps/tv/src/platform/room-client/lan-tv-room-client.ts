import type { HostConnection, RelaySocket, RoomHost } from '@huddle/room-host';
import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { AppState, type AppStateStatus } from 'react-native';

import { LAN_PORT, lanServer } from '../lan-server/native';
import { hostedRoom } from './hosted-room';
import type { TvRoomClient } from './index';

function file(name: string): File {
  return new File(Paths.document, `huddle-${name}`);
}

export function lanTvRoomClient(): TvRoomClient {
  const room = hostedRoom(
    {
      randomBytes: (count) => Crypto.getRandomValues(new Uint8Array(count)),
      read: (name) => {
        try {
          const target = file(name);
          return target.exists ? target.textSync() : undefined;
        } catch {
          return undefined;
        }
      },
      write: (name, text) => {
        try {
          const target = file(name);
          if (!target.exists) target.create();
          target.write(text);
        } catch (error) {
          console.warn(`Huddle TV could not save ${name}`, String(error));
        }
      },
      // React Native's WebSocket has these members; its handler types name DOM events.
      openSocket: (url) => new WebSocket(url) as unknown as RelaySocket,
    },
    process.env.EXPO_PUBLIC_HUDDLE_RELAY_URL,
  );
  const connections = new Map<number, HostConnection>();
  let port = LAN_PORT;
  let advertisedCode: string | undefined;
  let appState: AppStateStatus = AppState.currentState;
  let starting: Promise<RoomHost> | undefined;
  let wired = false;

  function advertise(code: string): void {
    advertisedCode = code;
    lanServer.advertise(code, port).catch((error: unknown) => {
      console.warn('Huddle TV could not advertise its room', String(error));
    });
  }

  async function startServer(host: RoomHost): Promise<void> {
    port = await lanServer.start(port);
    room.setAddress({ hosts: lanServer.addresses(), port });
    room.startRelay();
    advertise(host.info().code);
  }

  async function stopServer(): Promise<void> {
    room.stopRelay();
    advertisedCode = undefined;
    lanServer.stopAdvertising();
    for (const connection of connections.values()) connection.disconnect();
    connections.clear();
    await lanServer.stop();
  }

  function wire(host: RoomHost): void {
    if (wired) return;
    wired = true;
    room.onCodeChange((code) => {
      if (advertisedCode === undefined || advertisedCode === code) return;
      lanServer.stopAdvertising();
      advertise(code);
    });
    lanServer.addListener('onOpen', ({ id }) => {
      connections.set(id, host.connect((frame) => lanServer.send(id, frame), () => lanServer.close(id)));
    });
    lanServer.addListener('onMessage', ({ id, data }) => connections.get(id)?.receive(data));
    lanServer.addListener('onClose', ({ id }) => {
      connections.get(id)?.disconnect();
      connections.delete(id);
    });
    lanServer.addListener('onError', ({ message }) => console.warn('Huddle TV LAN server', message));
    AppState.addEventListener('change', (next) => {
      const wasActive = appState === 'active';
      appState = next;
      // Apple TV suspends a backgrounded app within seconds, so stop serving and mark the TV away.
      if (wasActive && next === 'background') {
        host.setTvAway(true);
        void stopServer();
      } else if (!wasActive && next === 'active') {
        void startServer(host).then(() => host.setTvAway(false));
      }
    });
  }

  return room.client(() => {
    starting ??= (async () => {
      const host = room.host();
      wire(host);
      await startServer(host);
      return host;
    })().catch((error: unknown) => {
      starting = undefined;
      throw error;
    });
    return starting;
  });
}
