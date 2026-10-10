import { ConvexHttpClient } from 'convex/browser';
import { anyApi as api } from 'convex/server';
import fs from 'node:fs';

const client = new ConvexHttpClient(process.env.CONVEX_URL ?? 'http://127.0.0.1:3210');
const codeFile = process.argv[2];
const tv = `e2e-tv-${Date.now()}`;
const room = await client.mutation(api.rooms.openRoom, { tvSessionToken: tv });
const bot = await client.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ana', avatar: 'fox' });
const beat = setInterval(() => {
  client.mutation(api.rooms.tvHeartbeat, { tvSessionToken: tv }).catch(() => {});
  client.mutation(api.players.heartbeat, { sessionToken: bot.sessionToken }).catch(() => {});
}, 4000);
fs.writeFileSync(codeFile, room.code);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const roster = async () => (await client.query(api.players.roster, { roomId: room.roomId, sessionToken: bot.sessionToken })) ?? [];
for (let i = 0; i < 120 && (await roster()).length < 2; i++) await sleep(1000);
await client.mutation(api.gameSetup.selectGame, { sessionToken: bot.sessionToken, gameId: 'trivia' });
await client.mutation(api.gameSetup.finalizeGameSetup, { sessionToken: bot.sessionToken });
await client.mutation(api.gameSetup.setGameReady, { sessionToken: bot.sessionToken, ready: true });
for (let i = 0; i < 120; i++) {
  const started = await client.mutation(api.gameSetup.startGame, { sessionToken: bot.sessionToken }).then(() => true, () => false);
  if (started) break;
  await sleep(1000);
}
await sleep(Number(process.env.HOLD_MS ?? 90000));
clearInterval(beat);
process.exit(0);
