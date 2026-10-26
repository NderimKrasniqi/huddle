import type { GameMetadata } from '@huddle/domain';

export const bombSquadMetadata: GameMetadata = {
  id: 'bomb-squad',
  title: 'Bomb Squad',
  playerRange: { min: 3, max: 10 },
  estimatedMinutes: 10,
  category: 'Party',
  tagline: 'One wire is safe. Someone is lying.',
};
