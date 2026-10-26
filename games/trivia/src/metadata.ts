import type { GameMetadata } from '@huddle/domain';

export const triviaMetadata: GameMetadata = {
  id: 'trivia',
  title: 'Trivia',
  playerRange: { min: 1, max: 10 },
  estimatedMinutes: 15,
  category: 'Quiz',
  tagline: 'Cosmic Quiz · Big guesses. Bigger laughs.',
};
