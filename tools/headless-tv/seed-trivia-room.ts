import { seedRoom, startWhenReady } from './seed-kit';

/** One bot Host waits for a phone, starts Trivia, and holds the room. */
const seed = await seedRoom([['Ana', 'fox']]);
await seed.host.waitFor(() => seed.roomSize() >= 2);
await seed.host.command('selectGame', { gameId: 'trivia' });
await seed.host.command('finalizeGameSetup', {});
await seed.host.command('setGameReady', { ready: true });
await startWhenReady(seed.host);
await seed.hold(90_000);
await seed.finish(0);
