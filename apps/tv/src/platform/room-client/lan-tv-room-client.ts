import type { LanJoin } from '@huddle/domain';
import { type HostConnection, type HostPorts, type HostSnapshot, RoomHost, type TvViews as HostViews } from '@huddle/room-host';
import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { LAN_PORT, lanServer } from '../lan-server/native';
import type { OpenRoom, TvRoomClient, TvSetupView, TvViewName, TvViews } from './index';

/** Saving waits this long after the last change, so a burst of taps is one write. */
const SAVE_DEBOUNCE_MS = 300;
const SNAPSHOT_FILE = 'huddle-room-snapshot.json';

type Store = {
  readonly roomId: string;
  readonly views: TvViews;
  readonly lan: LanJoin | undefined;
};

/**
 * The room client when the TV hosts its own room (ADR-01): the room host runs
 * in this app, phones reach it through the LAN server, and the TV's screens
 * read the host's shared views in-process.
 *
 * The host is created on the first `openRoom` and lives for the app. When the
 * app leaves the foreground the TV is marked away and the server stops (Apple
 * TV suspends a backgrounded app within seconds); coming back restarts the
 * server, advertises again and lets phones resume their seats.
 */
export function lanTvRoomClient(): TvRoomClient {
  let host: RoomHost | undefined;
  /** The room a restarted app picked back up; any later room is a new one. */
  let restoredRoomId: string | undefined;
  let starting: Promise<RoomHost> | undefined;
  let port = LAN_PORT;
  let store: Store | undefined;
  let lan: LanJoin | undefined;
  const listeners = new Set<() => void>();
  const connections = new Map<number, HostConnection>();
  let appState: AppStateStatus = AppState.currentState;

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

  function publish(views: HostViews): void {
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
    lan = { hosts: lanServer.addresses(), port, tvInstanceId: info.tvInstanceId };
    if (store !== undefined) store = { ...store, lan };
    for (const listener of listeners) listener();
    await lanServer.advertise(info.code, port).catch((error: unknown) => {
      console.warn('Huddle TV could not advertise its room', String(error));
    });
  }

  async function stopServer(): Promise<void> {
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
      if (wasActive && next === 'background') {
        running.setTvAway(true);
        void stopServer();
      } else if (!wasActive && next === 'active') {
        void startServer(running).then(() => running.setTvAway(false));
      }
    });
  }

  async function ensureHost(): Promise<RoomHost> {
    if (host !== undefined) return host;
    starting ??= (async () => {
      const created = new RoomHost(ports, readSnapshot());
      host = created;
      if (created.restored) restoredRoomId = created.info().roomId;
      created.subscribeTv(publish);
      wireServer(created);
      await startServer(created);
      return created;
    })();
    return await starting;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    deployed: true,
    openRoom: async (): Promise<OpenRoom> => {
      const running = await ensureHost();
      const info = running.info();
      return { roomId: info.roomId, code: info.code, restored: info.roomId === restoredRoomId, hasRunningGame: info.hasRunningGame };
    },
    heartbeat: async () => {},
    useView: <Name extends TvViewName>(name: Name, viewer: Parameters<TvRoomClient['useView']>[1]) =>
      useSyncExternalStore(subscribe, () => (viewer === undefined || store === undefined ? undefined : store.views[name])),
    useStillOpen: (roomId) => useSyncExternalStore(subscribe, () => (store === undefined ? undefined : store.roomId === roomId)),
    useLanJoin: () => useSyncExternalStore(subscribe, () => store?.lan ?? lan),
  };
}

/** The host's setup view with the countdown's end on this TV's clock. */
function setupView(setup: HostViews['setup']): TvSetupView | null {
  if (setup === null) return null;
  const { countdownRemainingMs, ...rest } = setup;
  return countdownRemainingMs === undefined ? rest : { ...rest, countdownEndsAt: Date.now() + countdownRemainingMs };
}

/**
 * The previous object when nothing but a clock moved, so screens and their
 * animations do not restart on every once-a-second sweep.
 */
function stable<T>(previous: T | undefined, next: T): T {
  if (previous === undefined) return next;
  return JSON.stringify(withoutClocks(previous)) === JSON.stringify(withoutClocks(next)) ? previous : next;
}

function withoutClocks(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const { clockRemainingMs: _clock, countdownEndsAt: _countdown, ...rest } = value as Record<string, unknown>;
  return rest;
}
