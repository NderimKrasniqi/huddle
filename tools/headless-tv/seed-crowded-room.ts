import type { AvatarId } from '@huddle/domain';

import { seedRoom } from './seed-kit';

const names = ['Alexandrina Maxwell', 'Bartholomew Jenkins', 'Constantine Oakley', 'Dorothea Featherst', 'Evangeline Whitmor', 'Fitzgerald Pennywo', 'Gwendolyn Ashcroft', 'Hieronymus Blackwo', 'Isadora Pemberton'];
const avatars: AvatarId[] = ['fox', 'pink-bunny', 'blue-robot', 'purple-owl', 'yellow-robot', 'red-robot', 'teal-bear', 'mint-cat', 'puppy'];
const seed = await seedRoom(names.map((name, index) => [name, avatars[index]!] as const));
await seed.host.waitFor(() => seed.roomSize() >= 10);
await seed.host.command('selectGame', { gameId: 'bomb-squad' });
await seed.host.command('finalizeGameSetup', {});
for (const bot of seed.bots) bot.stopBeating();
await seed.hold(90_000);
await seed.finish(0);
