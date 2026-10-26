import type { LanJoin } from '@huddle/domain';
import {
  type HostConnection,
  type HostPorts,
  type HostSnapshot,
  hostThroughRelay,
  type RelayHost,
  type RelaySocket,
  RoomHost,
  type TvViews as HostViews,
} from '@huddle/room-host';
import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { LAN_PORT, lanServer } from '../lan-server/native';
import type { OpenRoom, TvRoomClient, TvViewName, TvViews } from './index';
import { setupView, stable } from './views';

const SAVE_DEBOUNCE_MS = 300;
const SNAPSHOT_FILE = 'huddle-room-snapshot.json';
const RELAY_SECRET_FILE = 'huddle-relay-secret.txt';
const RELAY_URL = process.env.EXPO_PUBLIC_HUDDLE_RELAY_URL;

type Store = {
  readonly roomId: string;
  readonly views: TvViews;
  readonly lan: LanJoin | undefined;
};

export function lanTvRoomClient(): TvRoomClient {
  let host: RoomHost | undefined;
  let restoredRoomId: string | undefined;
  let starting: Promise<RoomHost> | undefined;
  let port = LAN_PORT;
  let store: Store | undefined;
  let lan: LanJoin | undefined;
  const listeners = new Set<() => void>();
  const connections = new Map<number, HostConnection>();
  let appState: AppStateStatus = AppState.currentState;

  let relay: RelayHost | undefined;
  let relayJoin: string | undefined;
  let advertisedCode: string | undefined;

  const snapshotFile = new File(Paths.document, SNAPSHOT_FILE);
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingSnapshot: HostSnapshot | undefined;

  const ports: HostPorts = {
    now: () => Date.now(),
    setTimer: (afterMs, run) => {
      const timer = setTimeout(run, afterMs);
      return () => clearTimeout(timer);
    },
    random: () => {
      const word = new Uint32Array(1);
      Crypto.getRandomValues(word);
      return (word[0] ?? 0) / 2 ** 32;
    },
    save: (snapshot) => {
      pendingSnapshot = snapshot;
      if (saveTimer !== undefined) return;
      saveTimer = setTimeout(() => {
        saveTimer = undefined;
        const latest = pendingSnapshot;
        pendingSnapshot = undefined;
        if (latest === undefined) return;
        try {
          if (!snapshotFile.exists) snapshotFile.create();
          snapshotFile.write(JSON.stringify(latest));
        } catch (error) {
          console.warn('Huddle TV could not save its room', String(error));
        }
      }, SAVE_DEBOUNCE_MS);
    },
    log: (message, details) => console.warn(message, JSON.stringify(details)),
  };

  function readSnapshot(): HostSnapshot | undefined {
    try {
      return snapshotFile.exists ? (JSON.parse(snapshotFile.textSync()) as HostSnapshot) : undefined;
    } catch {
      return undefined;
    }
  }

  function relaySecret(): string {
    const file = new File(Paths.document, RELAY_SECRET_FILE);
    try {
      if (file.exists) {
        const saved = file.textSync().trim();
        if (saved.length >= 16) return saved;
      }
    } catch {
    }
    const bytes = new Uint8Array(24);
    Crypto.getRandomValues(bytes);
    const secret = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    try {
      if (!file.exists) file.create();
      file.write(secret);
    } catch (error) {
      console.warn('Huddle TV could not save its relay secret', String(error));
    }
    return secret;
  }

  function setLan(next: LanJoin | undefined): void {
    lan = next;
    if (store !== undefined) store = { ...store, lan };
    for (const listener of listeners) listener();
  }

  function withRelay(base: LanJoin | undefined): LanJoin | undefined {
    if (base === undefined || relayJoin === undefined) return base;
    return { ...base, relay: relayJoin };
  }

  function startRelay(running: RoomHost): void {
    if (RELAY_URL === undefined || RELAY_URL === '' || relay !== undefined) return;
    const url = RELAY_URL;
    relay = hostThroughRelay(running, {
      url,
      secret: relaySecret(),
      open: (address) => new WebSocket(address) as unknown as RelaySocket,
      ports,
      onState: (state) => {
        relayJoin = state === 'registered' ? url : undefined;
        const base = lan === undefined ? undefined : { hosts: lan.hosts, port: lan.port, tvInstanceId: lan.tvInstanceId };
        setLan(withRelay(base));
      },
    });
  }

  function stopRelay(): void {
    relay?.stop();
    relay = undefined;
    relayJoin = undefined;
  }

  function advertise(code: string): void {
    advertisedCode = code;
    lanServer.advertise(code, port).catch((error: unknown) => {
      console.warn('Huddle TV could not advertise its room', String(error));
    });
  }

  function publish(views: HostViews): void {
    if (advertisedCode !== undefined && advertisedCode !== views.code) {
      lanServer.stopAdvertising();
      advertise(views.code);
    }
    const previous = store?.roomId === views.roomId ? store.views : undefined;
    store = {
      roomId: views.roomId,
      lan,
      views: {
        roster: stable(previous?.roster, views.roster),
        running: stable(previous?.running, views.running),
        browsing: views.browsing,
        setup: stable(previous?.setup, setupView(views.setup)),
        arrivals: stable(previous?.arrivals, views.arrivals),
      },
    };
    for (const listener of listeners) listener();
  }

  async function startServer(running: RoomHost): Promise<void> {
    port = await lanServer.start(port);
    const info = running.info();
    setLan(withRelay({ hosts: lanServer.addresses(), port, tvInstanceId: info.tvInstanceId }));
    startRelay(running);
    advertise(info.code);
  }

  async function stopServer(): Promise<void> {
    stopRelay();
    advertisedCode = undefined;
    lanServer.stopAdvertising();
    for (const connection of connections.values()) connection.disconnect();
    connections.clear();
    await lanServer.stop();
  }

  function wireServer(running: RoomHost): void {
    lanServer.addListener('onOpen', ({ id }) => {
      connections.set(
        id,
        running.connect(
          (frame) => lanServer.send(id, frame),
          () => lanServer.close(id),
        ),
      );
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
        running.setTvAway(true);
        void stopServer();
      } else if (!wasActive && next === 'active') {
        void startServer(running).then(() => running.setTvAway(false));
      }
    });
  }

  async function ensureHost(): Promise<RoomHost> {
    starting ??= (async () => {
      if (host === undefined) {
        const created = new RoomHost(ports, readSnapshot());
        host = created;
        if (created.restored) restoredRoomId = created.info().roomId;
        created.subscribeTv(publish);
        wireServer(created);
      }
      await startServer(host);
      return host;
    })().catch((error: unknown) => {
      starting = undefined;
      throw error;
    });
    return await starting;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    openRoom: async (): Promise<OpenRoom> => {
      const running = await ensureHost();
      const info = running.info();
      return { roomId: info.roomId, code: info.code, restored: info.roomId === restoredRoomId, hasRunningGame: info.hasRunningGame };
    },
    useView: <Name extends TvViewName>(name: Name, enabled = true) =>
      useSyncExternalStore(subscribe, () => (!enabled || store === undefined ? undefined : store.views[name])),
    useStillOpen: (roomId) => useSyncExternalStore(subscribe, () => (store === undefined ? undefined : store.roomId === roomId)),
    useLanJoin: () => useSyncExternalStore(subscribe, () => store?.lan ?? lan),
  };
}
