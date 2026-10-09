import type { GameModule } from '@huddle/contracts';

import { CAROUSEL_PLACEHOLDER_IDS } from './carousel-catalog';

/**
 * Reference cards for games that are not installed in this build yet.
 *
 * They intentionally have no settings or running screens. The optional
 * `placeholder` flag lets the apps render a clear "Coming soon" treatment,
 * while the server continues to accept only real entries from its logic
 * registry. They are deliberately ordered to match the Playroom picker:
 * Doodle Dash, Quick Poll, then Hot Take.
 */
export const CAROUSEL_PLACEHOLDERS: readonly GameModule[] = [
  {
    placeholder: true,
    metadata: {
      id: CAROUSEL_PLACEHOLDER_IDS[0],
      title: 'Doodle Dash',
      keyArt: { color: 'sage' },
      playerRange: { min: 2, max: 10 },
      estimatedMinutes: 10,
      category: 'Drawing',
      tagline: 'Draw it. Guess it. Laugh about it.',
    },
    settingsSchema: [],
    screens: {
      tv: () => null,
      phone: () => null,
    },
  },
  {
    placeholder: true,
    metadata: {
      id: CAROUSEL_PLACEHOLDER_IDS[1],
      title: 'Hot Take',
      keyArt: { color: 'justJoined' },
      playerRange: { min: 2, max: 10 },
      estimatedMinutes: 8,
      category: 'Debate',
      tagline: 'Spicy opinions. No wrong answers.',
    },
    settingsSchema: [],
    screens: {
      tv: () => null,
      phone: () => null,
    },
  },
];
