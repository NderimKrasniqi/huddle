import { ConvexHttpClient } from 'convex/browser';
import { anyApi as api } from 'convex/server';
import fs from 'node:fs';

const client = new ConvexHttpClient(process.env.CONVEX_URL ?? 'http://127.0.0.1:3210');
const codeFile = process.argv[2];
const tv = `e2e-tv-${Date.now()}`;
const room = await client.mutation(api.rooms.openRoom, { tvSessionToken: tv });
const bots = [];
for (const [index, nickname] of ['Ana', 'Bo'].entries()) bots.push(await client.mutation(api.players.joinRoom, { code: room.code, nickname, avatar: ['fox', 'puppy'][index] }));
const host = bots[0].sessionToken;
const send = (bot, event) => client.mutation(api.games.sendEvent, { sessionToken: bot.sessionToken, event }).catch(() => {});
const beat = setInterval(() => {
  client.mutation(api.rooms.tvHeartbeat, { tvSessionToken: tv }).catch(() => {});
  for (const bot of bots) client.mutation(api.players.heartbeat, { sessionToken: bot.sessionToken }).catch(() => {});
}, 4000);
fs.writeFileSync(codeFile, room.code);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const roster = async () => (await client.query(api.players.roster, { roomId: room.roomId, sessionToken: host })) ?? [];
for (let i = 0; i < 120 && (await roster()).length < 3; i++) await sleep(1000);
await client.mutation(api.gameSetup.selectGame, { sessionToken: host, gameId: 'sumo-bumpers' });
await client.mutation(api.gameSetup.finalizeGameSetup, { sessionToken: host });
for (const bot of bots) await client.mutation(api.gameSetup.setGameReady, { sessionToken: bot.sessionToken, ready: true });
for (let i = 0; i < 120; i++) {
  if (await client.mutation(api.gameSetup.startGame, { sessionToken: host }).then(() => true, () => false)) break;
  await sleep(1000);
}
let seen = '';
const until = Date.now() + Number(process.env.HOLD_MS ?? 120000);
while (Date.now() < until) {
  const state = (await client.query(api.games.running, { roomId: room.roomId, sessionToken: host }).catch(() => null))?.state;
  const key = state ? `${state.match}:${state.round}:${state.phase}` : '';
  if (state && key !== seen) {
    seen = key;
    if (state.phase === 'howTo') for (const bot of bots) await send(bot, { kind: 'gotIt' });
    if (state.phase === 'aim') for (const bot of bots) await send(bot, { kind: 'aim', match: state.match, round: state.round, dx: 0.1, dy: 0 });
  }
  await sleep(500);
}
clearInterval(beat);
process.exit(0);
