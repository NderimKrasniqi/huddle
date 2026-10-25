import { spawn } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { type HostPorts, RoomHost } from '@huddle/room-host';
import { WebSocketServer } from 'ws';

/**
 * The headless TV: the room host behind a WebSocket server on this machine,
 * with Node's clock, timers and crypto. The end-to-end seeds start one, and
 * `node --import tsx tools/headless-tv/headless-tv.ts` runs one on its own.
 *
 * The iPhone simulator reaches it at `ws://127.0.0.1:<port>`. It speaks the
 * same Room Protocol as the TV app's LAN server, so a phone cannot tell them
 * apart.
 */
export const DEFAULT_PORT = Number(process.env.HEADLESS_TV_PORT ?? 7777);

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
  return {
    host,
    code,
    url: `ws://127.0.0.1:${port}`,
    close: async () => {
      advertiser?.kill();
      host.dispose();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
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
