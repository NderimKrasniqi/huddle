import type { GameMetadata } from '@huddle/domain';

/** Metadata for the installed Trivia game, shared by its client and server entries. */
export const triviaMetadata: GameMetadata = {
  id: 'trivia',
  title: 'Trivia',
  keyArt: { color: 'ink' },
  playerRange: { min: 1, max: 10 },
  estimatedMinutes: 15,
  category: 'Quiz',
  tagline: 'Cosmic Quiz · Big guesses. Bigger laughs.',
};
