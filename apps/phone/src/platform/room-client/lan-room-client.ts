import {
  type CommandArgs,
  type CommandName,
  decodeHostMessage,
  encodeMessage,
  type HostMessage,
  PROTOCOL_VERSION,
  RoomRefusal,
  type ViewName,
} from '@huddle/contracts/protocol';
import { normalizeRoomCode, ROOM_CODE_LENGTH } from '@huddle/domain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { lanDiscovery } from '../lan-discovery/native';
import type { ConnectionProblem, JoinAvailability, PlayerSession, RoomClient, RoomViewName, RoomViews, SeatCredential, SetupView } from './index';

/** How long one address gets to answer before the next one is tried. */
const CONNECT_TIMEOUT_MS = 2_000;
/** How long a typed code gets to show up on the local network. */
const DISCOVERY_TIMEOUT_MS = 4_000;
/** Waits between reconnect attempts for a seated phone. */
const RECONNECT_DELAYS_MS = [500, 1_000, 2_000, 4_000, 5_000];
/** A join form asks again this often while it is open. */
const AVAILABILITY_REFRESH_MS = 3_000;
/** Where the phone keeps the TV address that goes with its Session Token. */
const SEAT_RECORD_KEY = 'huddle.lan.seat.v1';
/**
 * The relay's base URL (ADR-03), such as `wss://relay.huddle.tv`. Unset, a
 * typed code is looked up on the local network only. Metro inlines it at
 * bundle time.
 */
const RELAY_URL = process.env.EXPO_PUBLIC_HUDDLE_RELAY_URL || undefined;
/** The relay's close code for a room it does not hold. */
const RELAY_NO_ROOM = 4404;

type Endpoint = {
  readonly hosts: readonly string[];
  readonly port: number;
  readonly tvInstanceId?: string;
  /** The relay to try after the addresses, with the code it knows the room by. */
  readonly relay?: string;
  readonly code?: string;
  /** Local discovery was refused, so a room missing on the relay may still be on this network. */
  readonly lanDenied?: boolean;
};

type SeatRecord = Endpoint & {
  readonly sessionToken: string;
  readonly code: string;
};

/** The protocol version the TV refused us with, for the "Update Huddle" state (TASK-14). */
export class IncompatibleTv extends Error {
  constructor(readonly tvProtocol: number) {
    super(`The TV speaks protocol ${tvProtocol}; this phone speaks ${PROTOCOL_VERSION}`);
    this.name = 'IncompatibleTv';
  }
}

/** Local Network access is off for Huddle, so the phone cannot look for the TV. */
export class LocalNetworkDenied extends Error {
  constructor() {
    super('Local Network access is off for Huddle');
    this.name = 'LocalNetworkDenied';
  }
}

/** The relay holds no room with this code. */
export class RoomMissing extends Error {
  constructor() {
    super('The relay holds no room with this code');
    this.name = 'RoomMissing';
  }
}

/** Nothing on this network answered at the TV's addresses. */
export class TvUnreachable extends Error {
  constructor() {
    super('Could not reach the TV on this network');
    this.name = 'TvUnreachable';
  }
}

/**
 * One WebSocket connection to one TV's room host. It keeps the views the host
 * pushes and, while it holds a seat, reconnects with backoff and resumes the
 * seat by token after a drop.
 */
class TvLink {
  private socket: WebSocket | undefined;
  private readonly views = new Map<ViewName, unknown>();
  private readonly listeners = new Set<() => void>();
  private readonly pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private nextRequest = 1;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;
  /** The Session Token this link holds a seat with, if any. */
  seatToken: string | undefined;
  tvInstanceId: string | undefined;
  roomCode: string | undefined;

  constructor(private endpoint: Endpoint) {
    this.tvInstanceId = endpoint.tvInstanceId;
  }

  get hosts(): readonly string[] {
    return this.endpoint.hosts;
  }

  get port(): number {
    return this.endpoint.port;
  }

  get relay(): string | undefined {
    return this.endpoint.relay;
  }

  /**
   * Connects to the first address that answers and completes the handshake;
   * the relay comes last, for a phone that cannot reach the TV directly.
   */
  async open(): Promise<void> {
    let lastError: Error = new TvUnreachable();
    for (const host of this.endpoint.hosts) {
      try {
        const address = host.includes(':') ? `[${host}]` : host;
        await this.openAt(`ws://${address}:${this.endpoint.port}`);
        // Try the address that worked first next time.
        this.endpoint = { ...this.endpoint, hosts: [host, ...this.endpoint.hosts.filter((other) => other !== host)] };
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new TvUnreachable();
        if (error instanceof IncompatibleTv) throw error;
      }
    }
    const { relay, code } = this.endpoint;
    const room = code ?? this.roomCode;
    if (relay !== undefined && room !== undefined) {
      try {
        await this.openAt(`${relay.replace(/\/+$/u, '')}/v1/join/${encodeURIComponent(room)}`);
        return;
      } catch (error) {
        if (error instanceof IncompatibleTv) throw error;
        // With no address to try, a missing room is the answer, not a fault.
        if (error instanceof RoomMissing && this.endpoint.hosts.length === 0) {
          throw this.endpoint.lanDenied === true ? new LocalNetworkDenied() : error;
        }
      }
    }
    if (this.endpoint.lanDenied === true) throw new LocalNetworkDenied();
    throw lastError;
  }

  private openAt(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      let settled = false;
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.close();
        reject(error);
      };
      const timer = setTimeout(() => fail(new TvUnreachable()), CONNECT_TIMEOUT_MS);
      socket.onopen = () => socket.send(encodeMessage({ type: 'hello', protocol: PROTOCOL_VERSION }));
      socket.onerror = () => fail(new TvUnreachable());
      socket.onclose = (event) => {
        if (!settled) fail(event.code === RELAY_NO_ROOM ? new RoomMissing() : new TvUnreachable());
        else if (this.socket === socket) this.dropped();
      };
      socket.onmessage = (event) => {
        const decoded = decodeHostMessage(String(event.data));
        if (!decoded.ok) return;
        const message = decoded.message;
        if (!settled) {
          if (message.type === 'incompatible') return fail(new IncompatibleTv(message.protocol));
          if (message.type !== 'welcome') return;
          // A seat belongs to one TV, so a seated link must find that same TV
          // again. Any other link takes whichever TV answers at the address,
          // or the one a QR code named.
          const expected = this.seatToken !== undefined ? this.tvInstanceId : this.endpoint.tvInstanceId;
          if (expected !== undefined && message.tvInstanceId !== expected) {
            return fail(new TvUnreachable());
          }
          settled = true;
          clearTimeout(timer);
          this.tvInstanceId = message.tvInstanceId;
          this.roomCode = message.roomCode;
          this.socket = socket;
          this.reconnectAttempt = 0;
          resolve();
          return;
        }
        this.onMessage(message);
      };
    });
  }

  private onMessage(message: HostMessage): void {
    if (message.type === 'view') {
      this.views.set(message.name, message.name === 'setup' ? setupView(message.value) : message.value);
      this.notify();
    } else if (message.type === 'result') {
      const request = this.pending.get(message.requestId);
      this.pending.delete(message.requestId);
      if (request === undefined) return;
      if (message.ok) request.resolve(message.value);
      else request.reject(new RoomRefusal(message.rejection));
    } else if (message.type === 'closed') {
      // Removed, replaced or the room ended: the seat is gone, so stop coming back.
      this.seatToken = undefined;
      this.views.set('session', null);
      this.notify();
    }
  }

  private dropped(): void {
    this.socket = undefined;
    for (const request of this.pending.values()) request.reject(new TvUnreachable());
    this.pending.clear();
    if (this.disposed || this.seatToken === undefined) return;
    const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)] ?? 5_000;
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => void this.reconnect(), delay);
  }

  private async reconnect(): Promise<void> {
    const token = this.seatToken;
    if (this.disposed || token === undefined) return;
    try {
      await this.open();
      const session = await this.request('resumeSession', { sessionToken: token });
      if (session === null) {
        this.seatToken = undefined;
        this.views.set('session', null);
        this.notify();
      }
    } catch {
      this.dropped();
    }
  }

  get connected(): boolean {
    return this.socket !== undefined;
  }

  request<Name extends CommandName>(name: Name, args: CommandArgs<Name>): Promise<unknown> {
    const socket = this.socket;
    if (socket === undefined) return Promise.reject(new TvUnreachable());
    const requestId = this.nextRequest++;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      socket.send(encodeMessage({ type: 'command', requestId, name, args } as never));
    });
  }

  ping(): void {
    this.socket?.send(encodeMessage({ type: 'ping', sentAt: Date.now() }));
  }

  view(name: ViewName): unknown {
    return this.views.get(name);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  dispose(): void {
    this.disposed = true;
    this.seatToken = undefined;
    if (this.reconnectTimer !== undefined) clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = undefined;
  }
}

/** The protocol's setup view with the countdown's end on this phone's clock. */
function setupView(value: unknown): SetupView | null {
  if (value === null || typeof value !== 'object') return null;
  const { countdownRemainingMs, ...rest } = value as SetupView & { countdownRemainingMs?: number };
  return countdownRemainingMs === undefined ? rest : { ...rest, countdownEndsAt: Date.now() + countdownRemainingMs };
}

function endpointKey(endpoint: Endpoint): string {
  return endpoint.tvInstanceId ?? `${endpoint.hosts.join(',')}:${endpoint.port}|${endpoint.relay ?? ''}/${endpoint.code ?? ''}`;
}

/**
 * The phone's room client when the TV hosts the room (ADR-01): it reaches the
 * TV over Wi-Fi, by the QR code's addresses, by local discovery for a typed
 * code, or by the address saved with its Session Token.
 */
export function lanRoomClient(): RoomClient {
  const links = new Map<string, TvLink>();
  const knownByCode = new Map<string, Endpoint>();
  const seatLinks = new Map<string, TvLink>();
  const attaching = new Map<string, Promise<TvLink | undefined>>();
  let previewLink: TvLink | undefined;
  let problem: ConnectionProblem | undefined;
  const problemListeners = new Set<() => void>();

  function setProblem(next: ConnectionProblem | undefined): void {
    if (problem === next) return;
    problem = next;
    for (const listener of problemListeners) listener();
  }

  /** Records what went wrong reaching the TV, then hands the error on. */
  function noted(error: unknown): unknown {
    if (error instanceof LocalNetworkDenied) setProblem('localNetworkDenied');
    else if (error instanceof IncompatibleTv) setProblem('incompatible');
    else if (error instanceof TvUnreachable) setProblem('unreachable');
    return error;
  }

  /** Runs a step that reaches the TV, clearing the problem when it succeeds. */
  async function reaching<T>(step: () => Promise<T>): Promise<T> {
    try {
      const value = await step();
      setProblem(undefined);
      return value;
    } catch (error) {
      throw noted(error);
    }
  }

  async function linkFor(endpoint: Endpoint): Promise<TvLink> {
    const key = endpointKey(endpoint);
    let link = links.get(key);
    if (link === undefined) {
      link = new TvLink(endpoint);
      links.set(key, link);
    }
    if (!link.connected) await link.open();
    return link;
  }

  async function endpointForCode(raw: string): Promise<Endpoint | undefined> {
    const code = normalizeRoomCode(raw);
    if (code.length !== ROOM_CODE_LENGTH) return undefined;
    const known = knownByCode.get(code);
    if (known !== undefined) return known;
    let denied = false;
    const found = await lanDiscovery.find(code, DISCOVERY_TIMEOUT_MS).catch((error: unknown) => {
      if ((error as { code?: string }).code !== 'E_LOCAL_NETWORK_DENIED') throw error;
      if (RELAY_URL === undefined) throw new LocalNetworkDenied();
      denied = true;
      return null;
    });
    if (found === null || found.hosts.length === 0) {
      // Not on this network: ask the relay, without remembering the answer,
      // so the next look tries the network again.
      return RELAY_URL === undefined ? undefined : { hosts: [], port: 0, relay: RELAY_URL, code, ...(denied ? { lanDenied: true } : {}) };
    }
    const endpoint = { hosts: found.hosts, port: found.port, code, ...(RELAY_URL === undefined ? {} : { relay: RELAY_URL }) };
    knownByCode.set(code, endpoint);
    return endpoint;
  }

  async function readRecord(): Promise<SeatRecord | undefined> {
    try {
      const raw = await AsyncStorage.getItem(SEAT_RECORD_KEY);
      return raw === null ? undefined : (JSON.parse(raw) as SeatRecord);
    } catch {
      return undefined;
    }
  }

  async function writeRecord(record: SeatRecord | undefined): Promise<void> {
    try {
      if (record === undefined) await AsyncStorage.removeItem(SEAT_RECORD_KEY);
      else await AsyncStorage.setItem(SEAT_RECORD_KEY, JSON.stringify(record));
    } catch {
      // Losing the record only means the phone cannot find its TV after a relaunch.
    }
  }

  /**
   * A seated link answers to its TV, not to an address: file it under the TV
   * instance id, so the next lookup at that address (another room, a restarted
   * TV) gets a fresh link instead of one that only accepts the old TV.
   */
  function keepForSeat(link: TvLink): void {
    for (const [key, value] of links) if (value === link) links.delete(key);
    if (link.tvInstanceId !== undefined) links.set(link.tvInstanceId, link);
  }

  /** The link holding `sessionToken`'s seat, reconnecting from the saved record if needed. */
  function seatLink(sessionToken: string): Promise<TvLink | undefined> {
    const known = seatLinks.get(sessionToken);
    if (known !== undefined) return Promise.resolve(known);
    let pending = attaching.get(sessionToken);
    if (pending === undefined) {
      pending = (async () => {
        const record = await readRecord();
        if (record === undefined || record.sessionToken !== sessionToken) return undefined;
        // A seat saved before the relay was set still gets it as a fallback.
        const link = await linkFor(record.relay === undefined && RELAY_URL !== undefined ? { ...record, relay: RELAY_URL } : record);
        const session = await link.request('resumeSession', { sessionToken });
        if (session === null) return undefined;
        link.seatToken = sessionToken;
        seatLinks.set(sessionToken, link);
        keepForSeat(link);
        return link;
      })().finally(() => attaching.delete(sessionToken));
      attaching.set(sessionToken, pending);
    }
    return pending;
  }

  function useLink(seat: SeatCredential | undefined): TvLink | undefined {
    const [link, setLink] = useState<TvLink | undefined>(() => (seat === undefined ? undefined : seatLinks.get(seat.sessionToken)));
    const token = seat?.sessionToken;
    useEffect(() => {
      if (token === undefined) return;
      let live = true;
      seatLink(token)
        .then((found) => {
          if (live) setLink(found);
        })
        .catch(() => {});
      return () => {
        live = false;
      };
    }, [token]);
    return token === undefined ? undefined : link;
  }

  return {
    rememberTv: (code, lan) => {
      const normalized = normalizeRoomCode(code);
      knownByCode.set(normalized, {
        hosts: lan.hosts,
        port: lan.port,
        tvInstanceId: lan.tvInstanceId,
        code: normalized,
        ...(lan.relay === undefined ? {} : { relay: lan.relay }),
      });
    },

    useView: <Name extends RoomViewName>(name: Name, seat: SeatCredential | undefined) => {
      const link = useLink(seat);
      return useSyncExternalStore(
        (listener) => (link === undefined ? () => {} : link.subscribe(listener)),
        () => link?.view(name) as RoomViews[Name] | undefined,
      );
    },

    useJoinAvailability: (code) => {
      const [answer, setAnswer] = useState<{ code: string; value: JoinAvailability } | undefined>();
      useEffect(() => {
        if (code === undefined) return;
        let live = true;
        const ask = async () => {
          try {
            const value = await reaching(async () => {
              const endpoint = await endpointForCode(code);
              return endpoint === undefined
                ? null
                : ((await (await linkFor(endpoint)).request('joinAvailability', { code })) as JoinAvailability);
            });
            if (live) setAnswer({ code, value });
          } catch (error) {
            if (error instanceof RoomMissing && live) setAnswer({ code, value: null });
            // A problem reaching the TV shows its own screen; the form waits.
          }
        };
        void ask();
        const refresh = setInterval(() => void ask(), AVAILABILITY_REFRESH_MS);
        return () => {
          live = false;
          clearInterval(refresh);
        };
      }, [code]);
      return code !== undefined && answer?.code === code ? answer.value : undefined;
    },

    command: async (name, seat, args) => {
      if (name === 'leaveRoom') {
        // Leaving always works for the player. A TV that is gone or off cannot
        // hear it, and marks the silent seat away on its own if it comes back.
        const link = await seatLink(seat.sessionToken).catch(() => undefined);
        await link?.request('leaveRoom', {}).catch((error: unknown) => {
          if (!(error instanceof TvUnreachable)) throw error;
        });
        if (link !== undefined) link.seatToken = undefined;
        seatLinks.delete(seat.sessionToken);
        await writeRecord(undefined);
        return;
      }
      const link = await seatLink(seat.sessionToken);
      if (link === undefined) throw new RoomRefusal({ kind: 'notInRoom' });
      await link.request(name, args);
    },

    joinRoom: async (args) => {
      const endpoint = await reaching(() => endpointForCode(args.code));
      if (endpoint === undefined) throw new RoomRefusal({ kind: 'roomNotFound', code: normalizeRoomCode(args.code) });
      const link = await reaching(() => linkFor(endpoint)).catch((error: unknown) => {
        if (error instanceof RoomMissing) throw new RoomRefusal({ kind: 'roomNotFound', code: normalizeRoomCode(args.code) });
        throw error;
      });
      const seat = (await link.request('joinRoom', args)) as Awaited<ReturnType<RoomClient['joinRoom']>>;
      link.seatToken = seat.sessionToken;
      seatLinks.set(seat.sessionToken, link);
      keepForSeat(link);
      await writeRecord({
        sessionToken: seat.sessionToken,
        code: seat.code,
        hosts: link.hosts,
        port: link.port,
        ...(link.tvInstanceId === undefined ? {} : { tvInstanceId: link.tvInstanceId }),
        ...(link.relay === undefined ? {} : { relay: link.relay }),
      });
      return seat;
    },

    lookupSession: async (sessionToken): Promise<PlayerSession | null> => {
      const record = await readRecord();
      if (record === undefined || record.sessionToken !== sessionToken) return null;
      // Restoring a saved seat is not a join attempt: a TV that is gone or off
      // fails this lookup quietly, and the phone offers the join screen.
      const link = await seatLink(sessionToken);
      return link === undefined ? null : ((link.view('session') as PlayerSession | null | undefined) ?? null);
    },

    previewSeat: async (args) => {
      const endpoint = await endpointForCode(args.code);
      if (endpoint === undefined) return;
      previewLink = await linkFor(endpoint);
      await previewLink.request('previewSeat', args);
    },

    clearSeatPreview: async (previewKey) => {
      await previewLink?.request('clearSeatPreview', { previewKey });
    },

    heartbeat: async (sessionToken) => {
      seatLinks.get(sessionToken)?.ping();
    },

    useConnectionProblem: () =>
      useSyncExternalStore(
        (listener) => {
          problemListeners.add(listener);
          return () => problemListeners.delete(listener);
        },
        () => problem,
      ),

    retryConnection: () => setProblem(undefined),
  };
}
