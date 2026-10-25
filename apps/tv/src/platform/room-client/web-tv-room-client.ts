import type { LanJoin } from '@huddle/domain';
import {
  type HostPorts,
  type HostSnapshot,
  hostThroughRelay,
  type RelaySocket,
  RoomHost,
  type TvViews as HostViews,
} from '@huddle/room-host';
import { useSyncExternalStore } from 'react';

import type { OpenRoom, TvRoomClient, TvViewName, TvViews } from './index';
import { setupView, stable } from './views';

/** The browser APIs this client uses, typed here because the app's types are React Native's. */
type Browser = {
  readonly localStorage?: { getItem(key: string): string | null; setItem(key: string, value: string): void };
  readonly crypto: { getRandomValues<T extends Uint8Array | Uint32Array>(array: T): T };
  readonly WebSocket: new (url: string) => RelaySocket;
};
const browser = globalThis as unknown as Browser;

const SNAPSHOT_KEY = 'huddle.room-snapshot';
const RELAY_SECRET_KEY = 'huddle.relay-secret';
const SAVE_DEBOUNCE_MS = 300;
/** The relay's base URL. A web TV cannot listen, so without it no phone can join. */
const RELAY_URL = process.env.EXPO_PUBLIC_HUDDLE_RELAY_URL;

type Store = {
  readonly roomId: string;
  readonly views: TvViews;
};

function read(key: string): string | null {
  try {
    return browser.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    browser.localStorage?.setItem(key, value);
  } catch {
    // Private windows and full storage: the room still runs, it just does not survive a reload.
  }
}

function relaySecret(): string {
  const saved = read(RELAY_SECRET_KEY);
  if (saved !== null && saved.length >= 16) return saved;
  const bytes = browser.crypto.getRandomValues(new Uint8Array(24));
  const secret = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  write(RELAY_SECRET_KEY, secret);
  return secret;
}

/**
 * The room client for a TV that runs as a web app, such as a Samsung (Tizen)
 * or LG (webOS) shell (ADR-04). A browser cannot accept connections, so the
 * room host is reachable only through the relay; the snapshot and the relay
 * secret live in `localStorage`. TASK-23 runs it in Chromium as a smoke test.
 */
export function webTvRoomClient(): TvRoomClient {
  let host: RoomHost | undefined;
  let restoredRoomId: string | undefined;
  let store: Store | undefined;
  let lan: LanJoin | undefined;
  const listeners = new Set<() => void>();
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingSnapshot: HostSnapshot | undefined;

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const ports: HostPorts = {
    now: () => Date.now(),
    setTimer: (afterMs, run) => {
      const timer = setTimeout(run, afterMs);
      return () => clearTimeout(timer);
    },
    random: () => (browser.crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) / 2 ** 32,
    save: (snapshot) => {
      pendingSnapshot = snapshot;
      if (saveTimer !== undefined) return;
      saveTimer = setTimeout(() => {
        saveTimer = undefined;
        if (pendingSnapshot !== undefined) write(SNAPSHOT_KEY, JSON.stringify(pendingSnapshot));
        pendingSnapshot = undefined;
      }, SAVE_DEBOUNCE_MS);
    },
    log: (message, details) => console.warn(message, JSON.stringify(details)),
  };

  function readSnapshot(): HostSnapshot | undefined {
    try {
      const raw = read(SNAPSHOT_KEY);
      return raw === null ? undefined : (JSON.parse(raw) as HostSnapshot);
    } catch {
      return undefined;
    }
  }

  function publish(views: HostViews): void {
    const previous = store?.roomId === views.roomId ? store.views : undefined;
    store = {
      roomId: views.roomId,
      views: {
        roster: stable(previous?.roster, views.roster),
        running: stable(previous?.running, views.running),
        browsing: views.browsing,
        setup: stable(previous?.setup, setupView(views.setup)),
        arrivals: stable(previous?.arrivals, views.arrivals),
      },
    };
    notify();
  }

  function ensureHost(): RoomHost {
    if (host !== undefined) return host;
    const created = new RoomHost(ports, readSnapshot());
    host = created;
    if (created.restored) restoredRoomId = created.info().roomId;
    created.subscribeTv(publish);
    if (RELAY_URL === undefined || RELAY_URL === '') {
      console.warn('Huddle web TV has no EXPO_PUBLIC_HUDDLE_RELAY_URL; no phone can reach it');
    } else {
      const url = RELAY_URL;
      hostThroughRelay(created, {
        url,
        secret: relaySecret(),
        open: (address) => new browser.WebSocket(address),
        ports,
        onState: (state) => {
          const tvInstanceId = created.info().tvInstanceId;
          lan = state === 'registered' ? { hosts: [], port: 0, tvInstanceId, relay: url } : undefined;
          notify();
        },
      });
    }
    return created;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    deployed: true,
    openRoom: async (): Promise<OpenRoom> => {
      const running = ensureHost();
      const info = running.info();
      return { roomId: info.roomId, code: info.code, restored: info.roomId === restoredRoomId, hasRunningGame: info.hasRunningGame };
    },
    heartbeat: async () => {},
    useView: <Name extends TvViewName>(name: Name, viewer: Parameters<TvRoomClient['useView']>[1]) =>
      useSyncExternalStore(subscribe, () => (viewer === undefined || store === undefined ? undefined : store.views[name])),
    useStillOpen: (roomId) => useSyncExternalStore(subscribe, () => (store === undefined ? undefined : store.roomId === roomId)),
    useLanJoin: () => useSyncExternalStore(subscribe, () => lan),
  };
}
