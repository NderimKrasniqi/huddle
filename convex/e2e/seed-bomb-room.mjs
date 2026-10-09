import { ConvexHttpClient } from 'convex/browser';
import { anyApi as api } from 'convex/server';
import fs from 'node:fs';

const url = process.env.CONVEX_URL ?? 'http://127.0.0.1:3210';
const codeFile = process.argv[2];
const client = new ConvexHttpClient(url);
const tv = `e2e-tv-${Date.now()}`;
const room = await client.mutation(api.rooms.openRoom, { tvSessionToken: tv });
const bots = [];
for (const [index, nickname] of ['Ana', 'Bo', 'Cy'].entries()) {
  bots.push(await client.mutation(api.players.joinRoom, { code: room.code, nickname, avatar: ['fox', 'puppy', 'mint-cat'][index] }));
}
const host = bots[0].sessionToken;
const beat = setInterval(() => {
  client.mutation(api.rooms.tvHeartbeat, { tvSessionToken: tv }).catch(() => {});
  for (const bot of bots) client.mutation(api.players.heartbeat, { sessionToken: bot.sessionToken }).catch(() => {});
}, 4000);
fs.writeFileSync(codeFile, room.code);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const roster = async () => (await client.query(api.players.roster, { roomId: room.roomId, sessionToken: host })) ?? [];
for (let i = 0; i < 120 && (await roster()).length < 4; i++) await sleep(1000);

await client.mutation(api.gameSetup.selectGame, { sessionToken: host, gameId: 'bomb-squad' });
await client.mutation(api.gameSetup.finalizeGameSetup, { sessionToken: host });
for (const bot of bots) await client.mutation(api.gameSetup.setGameReady, { sessionToken: bot.sessionToken, ready: true });

let started = false;
for (let i = 0; i < 120 && !started; i++) {
  started = await client.mutation(api.gameSetup.startGame, { sessionToken: host }).then(() => true, () => false);
  if (!started) await sleep(1000);
}
for (let i = 0; i < 60; i++) {
  const state = (await client.query(api.games.running, { roomId: room.roomId, sessionToken: host }))?.state;
  if (state?.phase === 'howTo') {
    for (const bot of bots) await client.mutation(api.games.sendEvent, { sessionToken: bot.sessionToken, event: { kind: 'gotIt' } });
    break;
  }
  await sleep(500);
}
await sleep(Number(process.env.HOLD_MS ?? 60000));
clearInterval(beat);
process.exit(started ? 0 : 1);
