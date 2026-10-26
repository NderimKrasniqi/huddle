import type { LanJoin } from '@huddle/domain';
import {
  type HostPorts,
  type HostSnapshot,
  hostThroughRelay,
  type RelayHost,
  type RelaySocket,
  RoomHost,
  type TvViews as HostViews,
} from '@huddle/room-host';
import { useSyncExternalStore } from 'react';

import type { OpenRoom, TvRoomClient, TvViewName, TvViews } from './index';
import { setupView, stable } from './views';

export type TvPlatform = {
  readonly randomBytes: (count: number) => Uint8Array;
  readonly read: (name: string) => string | undefined;
  readonly write: (name: string, text: string) => void;
  readonly openSocket: (url: string) => RelaySocket;
};

export type HostedRoom = {
  readonly host: () => RoomHost;
  readonly setAddress: (address: { readonly hosts: readonly string[]; readonly port: number } | undefined) => void;
  readonly startRelay: () => void;
  readonly stopRelay: () => void;
  readonly onCodeChange: (listener: (code: string) => void) => void;
  readonly client: (openHost: () => Promise<RoomHost>) => TvRoomClient;
};

const SNAPSHOT = 'room-snapshot.json';
const RELAY_SECRET = 'relay-secret.txt';
const SAVE_DEBOUNCE_MS = 300;

export function hostedRoom(platform: TvPlatform, relayUrl: string | undefined): HostedRoom {
  let host: RoomHost | undefined;
  let restoredRoomId: string | undefined;
  let store: { readonly roomId: string; readonly views: TvViews } | undefined;
  let address: { readonly hosts: readonly string[]; readonly port: number } | undefined;
  let relay: RelayHost | undefined;
  let relayJoined = false;
  let join: LanJoin | undefined;
  let code: string | undefined;
  const codeListeners = new Set<(code: string) => void>();
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
    random: () => {
      const [a = 0, b = 0, c = 0, d = 0] = platform.randomBytes(4);
      return (((a << 24) | (b << 16) | (c << 8) | d) >>> 0) / 2 ** 32;
    },
    save: (snapshot) => {
      pendingSnapshot = snapshot;
      if (saveTimer !== undefined) return;
      saveTimer = setTimeout(() => {
        saveTimer = undefined;
        if (pendingSnapshot !== undefined) platform.write(SNAPSHOT, JSON.stringify(pendingSnapshot));
        pendingSnapshot = undefined;
      }, SAVE_DEBOUNCE_MS);
    },
    log: (message, details) => console.warn(message, JSON.stringify(details)),
  };

  function readSnapshot(): HostSnapshot | undefined {
    try {
      const raw = platform.read(SNAPSHOT);
      return raw === undefined ? undefined : (JSON.parse(raw) as HostSnapshot);
    } catch {
      return undefined;
    }
  }

  function relaySecret(): string {
    const saved = platform.read(RELAY_SECRET)?.trim();
    if (saved !== undefined && saved.length >= 16) return saved;
    const secret = Array.from(platform.randomBytes(24), (byte) => byte.toString(16).padStart(2, '0')).join('');
    platform.write(RELAY_SECRET, secret);
    return secret;
  }

  function refreshJoin(): void {
    const tvInstanceId = host?.info().tvInstanceId;
    const relayPart = relayJoined && relayUrl !== undefined ? { relay: relayUrl } : {};
    join =
      tvInstanceId === undefined || (address === undefined && !relayJoined)
        ? undefined
        : { hosts: address?.hosts ?? [], port: address?.port ?? 0, tvInstanceId, ...relayPart };
    notify();
  }

  function publish(views: HostViews): void {
    if (code !== views.code) {
      code = views.code;
      for (const listener of codeListeners) listener(views.code);
    }
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

  function ensure(): RoomHost {
    if (host !== undefined) return host;
    const created = new RoomHost(ports, readSnapshot());
    host = created;
    if (created.restored) restoredRoomId = created.info().roomId;
    created.subscribeTv(publish);
    return created;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    host: ensure,
    setAddress: (next) => {
      address = next;
      refreshJoin();
    },
    startRelay: () => {
      if (relayUrl === undefined || relayUrl === '' || relay !== undefined) return;
      relay = hostThroughRelay(ensure(), {
        url: relayUrl,
        secret: relaySecret(),
        open: platform.openSocket,
        ports,
        onState: (state) => {
          relayJoined = state === 'registered';
          refreshJoin();
        },
      });
    },
    stopRelay: () => {
      relay?.stop();
      relay = undefined;
      relayJoined = false;
      refreshJoin();
    },
    onCodeChange: (listener) => {
      codeListeners.add(listener);
    },
    client: (openHost) => ({
      openRoom: async (): Promise<OpenRoom> => {
        const running = await openHost();
        const info = running.info();
        return { roomId: info.roomId, code: info.code, restored: info.roomId === restoredRoomId, hasRunningGame: info.hasRunningGame };
      },
      useView: <Name extends TvViewName>(name: Name, enabled = true) =>
        useSyncExternalStore(subscribe, () => (!enabled || store === undefined ? undefined : store.views[name])),
      useStillOpen: (roomId) => useSyncExternalStore(subscribe, () => (store === undefined ? undefined : store.roomId === roomId)),
      useLanJoin: () => useSyncExternalStore(subscribe, () => join),
    }),
  };
}
