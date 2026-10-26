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

import type { SetupView } from './index';

const CONNECT_TIMEOUT_MS = 2_000;
const RECONNECT_DELAYS_MS = [500, 1_000, 2_000, 4_000, 5_000];
const RELAY_NO_ROOM = 4404;

export type Endpoint = {
  readonly hosts: readonly string[];
  readonly port: number;
  readonly tvInstanceId?: string;
  readonly relay?: string;
  readonly code?: string;
  readonly lanDenied?: boolean;
};

export class IncompatibleTv extends Error {
  constructor(readonly tvProtocol: number) {
    super(`The TV speaks protocol ${tvProtocol}; this phone speaks ${PROTOCOL_VERSION}`);
    this.name = 'IncompatibleTv';
  }
}

export class LocalNetworkDenied extends Error {
  constructor() {
    super('Local Network access is off for Huddle');
    this.name = 'LocalNetworkDenied';
  }
}

export class RoomMissing extends Error {
  constructor() {
    super('The relay holds no room with this code');
    this.name = 'RoomMissing';
  }
}

export class TvUnreachable extends Error {
  constructor() {
    super('Could not reach the TV on this network');
    this.name = 'TvUnreachable';
  }
}

export class TvLink {
  private socket: WebSocket | undefined;
  private readonly views = new Map<ViewName, unknown>();
  private readonly listeners = new Set<() => void>();
  private readonly pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private nextRequest = 1;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;
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

  async open(): Promise<void> {
    let lastError: Error = new TvUnreachable();
    for (const host of this.endpoint.hosts) {
      try {
        const address = host.includes(':') ? `[${host}]` : host;
        await this.openAt(`ws://${address}:${this.endpoint.port}`);
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
        // With no LAN address to try, the relay's 'no room' is the answer, not a fault.
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

function setupView(value: unknown): SetupView | null {
  if (value === null || typeof value !== 'object') return null;
  const { countdownRemainingMs, ...rest } = value as SetupView & { countdownRemainingMs?: number };
  return countdownRemainingMs === undefined ? rest : { ...rest, countdownEndsAt: Date.now() + countdownRemainingMs };
}

export function endpointKey(endpoint: Endpoint): string {
  return endpoint.tvInstanceId ?? `${endpoint.hosts.join(',')}:${endpoint.port}|${endpoint.relay ?? ''}/${endpoint.code ?? ''}`;
}
