import type { HostPorts } from './ports';
import type { HostConnection, RoomHost } from './room-host';

export type RelaySocket = {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: (() => void) | null;
  onmessage: ((event: { readonly data: unknown }) => void) | null;
  onclose: ((event: { readonly code: number }) => void) | null;
  onerror: (() => void) | null;
};

export type RelayState = 'connecting' | 'registered' | 'refused' | 'stopped';

export type RelayHostOptions = {
  readonly url: string;
  readonly secret: string;
  readonly open: (url: string) => RelaySocket;
  readonly ports: Pick<HostPorts, 'setTimer' | 'log'>;
  readonly onState?: (state: RelayState, code: string) => void;
};

export type RelayHost = {
  readonly state: () => RelayState;
  readonly stop: () => void;
};

const RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000];
const CODE_RETRIES = 5;

type FromRelay =
  | { readonly type: 'registered'; readonly code: string }
  | { readonly type: 'refused'; readonly reason: string }
  | { readonly type: 'open'; readonly id: number }
  | { readonly type: 'frame'; readonly id: number; readonly data: string }
  | { readonly type: 'close'; readonly id: number };

export function hostThroughRelay(host: RoomHost, options: RelayHostOptions): RelayHost {
  const connections = new Map<number, HostConnection>();
  let socket: RelaySocket | undefined;
  let state: RelayState = 'connecting';
  let code = host.info().code;
  let attempt = 0;
  let codeRetries = 0;
  let cancelRetry: (() => void) | undefined;
  let stopped = false;

  const setState = (next: RelayState) => {
    state = next;
    options.onState?.(next, code);
  };

  const dropPhones = () => {
    for (const connection of connections.values()) connection.disconnect();
    connections.clear();
  };

  const send = (message: Record<string, unknown>) => socket?.send(JSON.stringify(message));

  const retryLater = () => {
    if (stopped) return;
    const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)] ?? 30_000;
    attempt += 1;
    cancelRetry = options.ports.setTimer(delay, connect);
  };

  const onMessage = (message: FromRelay) => {
    switch (message.type) {
      case 'registered':
        attempt = 0;
        codeRetries = 0;
        setState('registered');
        return;
      case 'refused':
        // Codes are minted on the TV, so another TV may hold this one; an empty room takes a fresh code.
        if (message.reason === 'codeTaken' && codeRetries < CODE_RETRIES && host.replaceEmptyRoom()) {
          codeRetries += 1;
          return;
        }
        options.ports.log?.('Huddle relay refused the room', { reason: message.reason, code });
        setState('refused');
        return;
      case 'open': {
        const id = message.id;
        connections.set(
          id,
          host.connect(
            (frame) => send({ type: 'frame', id, data: frame }),
            () => {
              connections.delete(id);
              send({ type: 'close', id });
            },
          ),
        );
        return;
      }
      case 'frame':
        connections.get(message.id)?.receive(message.data);
        return;
      case 'close':
        connections.get(message.id)?.disconnect();
        connections.delete(message.id);
        return;
    }
  };

  function connect(): void {
    cancelRetry = undefined;
    if (stopped) return;
    setState('connecting');
    let opened: RelaySocket;
    try {
      opened = options.open(`${options.url.replace(/\/+$/u, '')}/v1/host`);
    } catch {
      retryLater();
      return;
    }
    socket = opened;
    opened.onopen = () => opened.send(JSON.stringify({ type: 'register', code, secret: options.secret }));
    opened.onmessage = (event) => {
      if (socket !== opened) return;
      try {
        onMessage(JSON.parse(String(event.data)) as FromRelay);
      } catch {
      }
    };
    opened.onerror = () => {};
    opened.onclose = () => {
      if (socket !== opened) return;
      socket = undefined;
      dropPhones();
      if (state === 'refused') return;
      retryLater();
    };
  }

  const reregister = () => {
    const previous = socket;
    socket = undefined;
    dropPhones();
    previous?.close(1000, 'new code');
    cancelRetry?.();
    attempt = 0;
    connect();
  };

  const unsubscribe = host.subscribeTv((views) => {
    if (views.code === code) return;
    code = views.code;
    if (!stopped) reregister();
  });

  connect();

  return {
    state: () => state,
    stop: () => {
      if (stopped) return;
      stopped = true;
      unsubscribe();
      cancelRetry?.();
      const previous = socket;
      socket = undefined;
      dropPhones();
      previous?.close(1000, 'tv stopped');
      setState('stopped');
    },
  };
}
