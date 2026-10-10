import { ConvexHttpClient } from 'convex/browser';
import { anyApi as api } from 'convex/server';
import fs from 'node:fs';

const client = new ConvexHttpClient(process.env.CONVEX_URL ?? 'http://127.0.0.1:3210');
const codeFile = process.argv[2];
const tv = `e2e-tv-${Date.now()}`;
const room = await client.mutation(api.rooms.openRoom, { tvSessionToken: tv });
const names = ['Alexandrina Maxwell', 'Bartholomew Jenkins', 'Constantine Oakley', 'Dorothea Featherst', 'Evangeline Whitmor', 'Fitzgerald Pennywo', 'Gwendolyn Ashcroft', 'Hieronymus Blackwo', 'Isadora Pemberton'];
const avatars = ['fox', 'pink-bunny', 'blue-robot', 'purple-owl', 'yellow-robot', 'red-robot', 'teal-bear', 'mint-cat', 'puppy'];
const bots = [];
for (const [index, nickname] of names.entries()) bots.push(await client.mutation(api.players.joinRoom, { code: room.code, nickname, avatar: avatars[index] }));
const tvBeat = setInterval(() => client.mutation(api.rooms.tvHeartbeat, { tvSessionToken: tv }).catch(() => {}), 4000);
let botBeat = setInterval(() => {
  for (const bot of bots) client.mutation(api.players.heartbeat, { sessionToken: bot.sessionToken }).catch(() => {});
}, 4000);
fs.writeFileSync(codeFile, room.code);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const host = bots[0].sessionToken;
const roster = async () => (await client.query(api.players.roster, { roomId: room.roomId, sessionToken: host })) ?? [];
for (let i = 0; i < 120 && (await roster()).length < 10; i++) await sleep(1000);
await client.mutation(api.gameSetup.selectGame, { sessionToken: host, gameId: 'bomb-squad' });
await client.mutation(api.gameSetup.finalizeGameSetup, { sessionToken: host });
clearInterval(botBeat);
await sleep(Number(process.env.HOLD_MS ?? 90000));
clearInterval(tvBeat);
process.exit(0);
