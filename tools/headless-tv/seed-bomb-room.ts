import { seedRoom, startWhenReady, stateOf } from './seed-kit';

const seed = await seedRoom([['Ana', 'fox'], ['Bo', 'puppy'], ['Cy', 'mint-cat']]);
await seed.host.waitFor(() => seed.roomSize() >= 4);
await seed.host.command('selectGame', { gameId: 'bomb-squad' });
await seed.host.command('finalizeGameSetup', {});
for (const bot of seed.bots) await bot.command('setGameReady', { ready: true });
const started = await startWhenReady(seed.host);
if (started) {
  await seed.host.waitFor((host) => stateOf(host)?.phase === 'howTo', 30_000).catch(() => {});
  for (const bot of seed.bots) await bot.attempt('sendEvent', { event: { kind: 'gotIt' } });
}
await seed.hold(60_000);
await seed.finish(started ? 0 : 1);
