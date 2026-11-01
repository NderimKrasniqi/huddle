import fs from 'node:fs';

import { Bot } from './bot';
import { DEFAULT_PORT, startHeadlessTv } from './headless-tv';
import { sleep } from './seed-kit';

const rooms = await Promise.all(
  ([['Ana', 'fox'], ['Bea', 'puppy']] as const).map(async ([nickname, avatar], index) => {
    const tv = await startHeadlessTv(DEFAULT_PORT + index);
    const bot = await Bot.connect(tv.url, nickname);
    await bot.command('joinRoom', { code: tv.code, nickname, avatar });
    bot.startBeating();
    return { tv, bot };
  }),
);
const codeFile = process.argv[2];
if (codeFile !== undefined) fs.writeFileSync(codeFile, rooms.map((room) => room.tv.code).join('\n'));
console.log(`Seeded rooms ${rooms.map((room) => `${room.tv.code} on ${room.tv.url}`).join(' and ')}`);
await sleep(Number(process.env.HOLD_MS ?? 120_000));
for (const room of rooms) {
  room.bot.close();
  await room.tv.close();
}
process.exit(0);
