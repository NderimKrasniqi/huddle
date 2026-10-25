import fs from 'node:fs';

import type { AvatarId } from '@huddle/domain';

import { Bot } from './bot';
import { type HeadlessTv, startHeadlessTv } from './headless-tv';

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The TV a seed plays against: its own headless TV, or a running one from `TV_URL`. */
type SeedTv = Pick<HeadlessTv, 'code' | 'url' | 'close'>;

export type Seed = {
  readonly tv: SeedTv;
  /** The first bot is the Host; every bot beats until told otherwise. */
  readonly bots: readonly Bot[];
  readonly host: Bot;
  readonly roomSize: () => number;
  readonly hold: (defaultMs: number) => Promise<void>;
  readonly finish: (exitCode: number) => Promise<never>;
};

/**
 * Starts a headless TV, seats the bots, and writes the room code to the file
 * the end-to-end script waits on (the first argument), as the Convex seeds did.
 * With `TV_URL` set (for example `ws://192.168.1.20:7777`), the bots join that
 * running TV instead, such as the TV app on a simulator.
 */
export async function seedRoom(players: readonly (readonly [string, AvatarId])[]): Promise<Seed> {
  const codeFile = process.argv[2];
  const tv = await seedTv();
  const bots: Bot[] = [];
  for (const [nickname, avatar] of players) {
    const bot = await Bot.connect(tv.url, nickname);
    await bot.command('joinRoom', { code: tv.code, nickname, avatar });
    bot.startBeating();
    bots.push(bot);
  }
  if (codeFile !== undefined) fs.writeFileSync(codeFile, tv.code);
  console.log(`Seeded room ${tv.code} on ${tv.url} with ${bots.map((bot) => bot.name).join(', ')}`);
  const host = bots[0]!;
  return {
    tv,
    bots,
    host,
    roomSize: () => host.view('roster')?.length ?? 0,
    hold: (defaultMs) => sleep(Number(process.env.HOLD_MS ?? defaultMs)),
    finish: async (exitCode) => {
      for (const bot of bots) bot.close();
      await tv.close();
      process.exit(exitCode);
    },
  };
}

async function seedTv(): Promise<SeedTv> {
  const url = process.env.TV_URL;
  if (url === undefined) return await startHeadlessTv();
  const probe = await Bot.connect(url, 'probe');
  const code = probe.roomCode ?? '';
  probe.close();
  return { url, code, close: async () => {} };
}

/** Retries the Host's start once a second until the room lets it start. */
export async function startWhenReady(host: Bot, tries = 120): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    if (await host.attempt('startGame', {})) return true;
    await sleep(1000);
  }
  return false;
}

/** The running game's state as the given bot sees it. */
export function stateOf(bot: Bot): Record<string, unknown> | undefined {
  const running = bot.view('running');
  return running?.kind === 'running' ? (running.state as Record<string, unknown>) : undefined;
}
