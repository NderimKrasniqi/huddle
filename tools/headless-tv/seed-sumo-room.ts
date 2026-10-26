import { seedRoom, startWhenReady, stateOf } from './seed-kit';

const seed = await seedRoom([['Ana', 'fox'], ['Bo', 'puppy']]);
await seed.host.waitFor(() => seed.roomSize() >= 3);
await seed.host.command('selectGame', { gameId: 'sumo-bumpers' });
await seed.host.command('finalizeGameSetup', {});
for (const bot of seed.bots) await bot.command('setGameReady', { ready: true });
await startWhenReady(seed.host);

let seen = '';
const until = Date.now() + Number(process.env.HOLD_MS ?? 120_000);
await new Promise<void>((resolve) => {
  const check = () => {
    if (Date.now() >= until) return resolve();
    const state = stateOf(seed.host);
    const key = state === undefined ? '' : `${String(state.match)}:${String(state.round)}:${String(state.phase)}`;
    if (state !== undefined && key !== seen) {
      seen = key;
      for (const bot of seed.bots) {
        if (state.phase === 'howTo') void bot.attempt('sendEvent', { event: { kind: 'gotIt' } });
        if (state.phase === 'aim') void bot.attempt('sendEvent', { event: { kind: 'aim', match: state.match, round: state.round, dx: 0.1, dy: 0 } });
      }
    }
    setTimeout(check, 250);
  };
  check();
});
await seed.finish(0);
