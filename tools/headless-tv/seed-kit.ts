import fs from 'node:fs';

import type { AvatarId } from '@huddle/domain';

import { Bot } from './bot';
import { type HeadlessTv, startHeadlessTv } from './headless-tv';

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type SeedTv = Pick<HeadlessTv, 'code' | 'url' | 'close'>;

export type Seed = {
  readonly tv: SeedTv;
  readonly bots: readonly Bot[];
  readonly host: Bot;
  readonly roomSize: () => number;
  readonly hold: (defaultMs: number) => Promise<void>;
  readonly finish: (exitCode: number) => Promise<never>;
};

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

export async function startWhenReady(host: Bot, tries = 120): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    if (await host.attempt('startGame', {})) return true;
    await sleep(1000);
  }
  return false;
}

export function stateOf(bot: Bot): Record<string, unknown> | undefined {
  const running = bot.view('running');
  return running?.kind === 'running' ? (running.state as Record<string, unknown>) : undefined;
}
