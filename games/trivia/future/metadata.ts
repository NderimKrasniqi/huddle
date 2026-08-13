import type { GameMetadata } from '@huddle/domain';

/** Metadata retained with the future playable engine; production uses src/metadata.ts. */
export const triviaMetadata: GameMetadata = {
  id: 'trivia',
  title: 'Trivia',
  keyArt: { color: 'ink' },
  playerRange: { min: 2, max: 10 },
  estimatedMinutes: 15,
  category: 'Quiz',
};
