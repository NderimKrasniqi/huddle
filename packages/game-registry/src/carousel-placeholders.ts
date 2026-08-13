import type { GameModule } from '@huddle/contracts';

import { CAROUSEL_PLACEHOLDER_IDS } from './carousel-catalog';

/**
 * Reference cards for games that are not installed in this build yet.
 *
 * They intentionally have no settings or running screens. The optional
 * `placeholder` flag lets the apps render a clear "Coming soon" treatment,
 * while the server continues to accept only real entries from its logic
 * registry.
 */
export const CAROUSEL_PLACEHOLDERS: readonly GameModule[] = [
  {
    placeholder: true,
    metadata: {
      id: CAROUSEL_PLACEHOLDER_IDS[0],
      title: 'Draw Battle',
      keyArt: { color: 'sage' },
      playerRange: { min: 2, max: 10 },
      estimatedMinutes: 10,
      category: 'Drawing',
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
      title: 'Word Sneak',
      keyArt: { color: 'online' },
      playerRange: { min: 2, max: 10 },
      estimatedMinutes: 8,
      category: 'Wordplay',
    },
    settingsSchema: [],
    screens: {
      tv: () => null,
      phone: () => null,
    },
  },
];
