import { spawn } from 'node:child_process';
import { randomBytes, randomInt } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { type HostPorts, hostThroughRelay, type RelayHost, type RelaySocket, RoomHost } from '@huddle/room-host';
import { WebSocketServer } from 'ws';

/**
 * The headless TV: the room host behind a WebSocket server on this machine,
 * with Node's clock, timers and crypto. The end-to-end seeds start one, and
 * `node --import tsx tools/headless-tv/headless-tv.ts` runs one on its own.
 *
 * The iPhone simulator reaches it at `ws://127.0.0.1:<port>`. It speaks the
 * same Room Protocol as the TV app's LAN server, so a phone cannot tell them
 * apart.
 *
 * `HEADLESS_TV_RELAY` (such as `ws://127.0.0.1:8787`) also hosts the room
 * through the relay, as the TV app does. `HEADLESS_TV_LAN=0` turns the LAN
 * server and its announcement off, so phones and bots can only come through
 * the relay, like a web TV.
 */
export const DEFAULT_PORT = Number(process.env.HEADLESS_TV_PORT ?? 7777);
const RELAY_URL = process.env.HEADLESS_TV_RELAY || undefined;
const LAN = process.env.HEADLESS_TV_LAN !== '0';
/** How long the headless TV waits for the relay to take its code. */
const RELAY_REGISTER_MS = 10_000;

export type HeadlessTv = {
  readonly host: RoomHost;
  readonly code: string;
  readonly url: string;
  readonly close: () => Promise<void>;
};

const nodePorts: HostPorts = {
  now: () => Date.now(),
  setTimer: (afterMs, run) => {
    const timer = setTimeout(run, afterMs);
    return () => clearTimeout(timer);
  },
  random: () => randomInt(0, 2 ** 32) / 2 ** 32,
  log: (message, details) => console.warn(message, JSON.stringify(details)),
};

export async function startHeadlessTv(port: number = DEFAULT_PORT): Promise<HeadlessTv> {
  const host = new RoomHost(nodePorts);
  if (!LAN && RELAY_URL === undefined) throw new Error('HEADLESS_TV_LAN=0 needs HEADLESS_TV_RELAY');
  const relay = RELAY_URL === undefined ? undefined : await registerOnRelay(host, RELAY_URL);
  if (!LAN) {
    const code = host.info().code;
    return {
      host,
      code,
      url: `${RELAY_URL}/v1/join/${code}`,
      close: async () => {
        relay?.stop();
        host.dispose();
      },
    };
  }
  const server = new WebSocketServer({ port, maxPayload: 256 * 1024 });
  server.on('connection', (socket) => {
    const connection = host.connect(
      (frame) => socket.send(frame),
      () => socket.close(),
    );
    socket.on('message', (data, isBinary) => {
      if (isBinary) {
        socket.close();
        return;
      }
      connection.receive(data.toString());
    });
    socket.on('close', () => connection.disconnect());
    socket.on('error', () => connection.disconnect());
  });
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const code = host.info().code;
  // On a Mac, announce the room like a TV would, so a phone simulator can find
  // a typed code. The simulators share this machine's network, so 127.0.0.1 works.
  const advertiser =
    process.platform === 'darwin'
      ? spawn('dns-sd', ['-R', `Huddle-${code}`, '_huddle._tcp', 'local', String(port), `code=${code}`, `port=${port}`, 'hosts=127.0.0.1'], { stdio: 'ignore' })
      : undefined;
  if (advertiser !== undefined) {
    // The e2e scripts end a seed with SIGTERM; the announcement must not outlive the room.
    process.once('exit', () => advertiser.kill());
    process.once('SIGTERM', () => {
      advertiser.kill();
      process.exit(0);
    });
  }
  return {
    host,
    code,
    url: `ws://127.0.0.1:${port}`,
    close: async () => {
      advertiser?.kill();
      relay?.stop();
      host.dispose();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

/** Hosts the room through the relay and waits until the relay holds its code. */
function registerOnRelay(host: RoomHost, url: string): Promise<RelayHost> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      relay.stop();
      reject(new Error(`The relay at ${url} did not take the room within ${RELAY_REGISTER_MS} ms`));
    }, RELAY_REGISTER_MS);
    const relay: RelayHost = hostThroughRelay(host, {
      url,
      secret: randomBytes(24).toString('hex'),
      open: (address) => new WebSocket(address) as unknown as RelaySocket,
      ports: nodePorts,
      onState: (state, code) => {
        if (state === 'registered') {
          clearTimeout(timeout);
          console.log(`Relay ${url} holds room ${code}`);
          resolve(relay);
        } else if (state === 'refused') {
          clearTimeout(timeout);
          reject(new Error(`The relay at ${url} refused room ${code}`));
        }
      },
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const tv = await startHeadlessTv();
  console.log(`Headless TV listening on ${tv.url}, room ${tv.code}`);
  let last = '';
  tv.host.subscribeTv((views) => {
    const line = `room ${views.code}: ${views.roster.map((seat) => `${seat.nickname}${seat.host ? '*' : ''}${seat.away ? ' (away)' : ''}`).join(', ') || 'empty'}`;
    if (line !== last) console.log((last = line));
  });
  const stop = () => void tv.close().then(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
