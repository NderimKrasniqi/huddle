import type { GamePlayerId } from '@huddle/domain';

import type { VotingPrompt } from './types';

/** Server-only opinion prompts. Client entrypoints receive only the active projection. */
export const VOTING_PROMPTS: readonly VotingPrompt[] = [
  { text: 'Best movie-night snack?', options: ['Popcorn', 'Pizza', 'Candy', 'Nachos'] },
  { text: 'Ideal weekend plan?', options: ['Beach day', 'Movie marathon', 'Road trip', 'Stay home'] },
  { text: 'The coziest drink?', options: ['Hot chocolate', 'Tea', 'Coffee', 'Cider'] },
  { text: 'Pick a dream group trip.', options: ['Big city', 'Cabin', 'Island', 'Theme park'] },
  { text: 'Which pet has the best energy?', options: ['Dog', 'Cat', 'Rabbit', 'Parrot'] },
  { text: 'Best late-night food?', options: ['Tacos', 'Noodles', 'Burgers', 'Breakfast'] },
  { text: 'Choose the room soundtrack.', options: ['Pop', 'Rock', 'Hip-hop', 'Throwbacks'] },
  { text: 'What makes a party great?', options: ['Good food', 'Great music', 'Fun games', 'The people'] },
  { text: 'Pick a superpower for one day.', options: ['Fly', 'Teleport', 'Pause time', 'Read minds'] },
  { text: 'Best way to spend a rainy day?', options: ['Bake', 'Game', 'Read', 'Nap'] },
  { text: 'Choose a friendly competition.', options: ['Bowling', 'Mini golf', 'Karaoke', 'Arcade'] },
  { text: 'Which season has the best vibe?', options: ['Spring', 'Summer', 'Autumn', 'Winter'] },
  { text: 'Pick the best shared dessert.', options: ['Cake', 'Ice cream', 'Brownies', 'Fruit'] },
  { text: 'What should the room learn together?', options: ['Dance', 'Cook', 'Paint', 'Play music'] },
  { text: 'Choose a perfect day off.', options: ['Explore', 'Create', 'Socialize', 'Recharge'] },
  { text: 'Best seat in the house?', options: ['Big sofa', 'Armchair', 'Floor cushions', 'By the window'] },
  { text: 'Pick a classic game-night prize.', options: ['Trophy', 'Snack pick', 'Playlist control', 'Bragging rights'] },
  { text: 'Which place feels most relaxing?', options: ['Forest', 'Ocean', 'Mountains', 'Home'] },
  { text: 'Choose tomorrow’s breakfast.', options: ['Pancakes', 'Eggs', 'Pastries', 'Smoothies'] },
  { text: 'What belongs in every living room?', options: ['Plants', 'Blankets', 'Speakers', 'Books'] },
  { text: 'Pick a group photo style.', options: ['Serious', 'Silly', 'Candid', 'Dramatic'] },
] as const;

function seedFor(playerIds: readonly GamePlayerId[]): number {
  let seed = 0;
  for (const character of [...playerIds].sort().join('|')) {
    seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
  }
  return seed;
}

/** Deterministically varies the prompt run without reading time or randomness. */
export function promptsFor(count: number, playerIds: readonly GamePlayerId[]): readonly VotingPrompt[] {
  const start = seedFor(playerIds) % VOTING_PROMPTS.length;
  return Array.from(
    { length: count },
    (_, index) => VOTING_PROMPTS[(start + index) % VOTING_PROMPTS.length]!,
  );
}
