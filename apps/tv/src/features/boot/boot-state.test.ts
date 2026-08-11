import { describe, expect, it } from 'vitest';

import { tvBootPresentation, type TvBootPhase } from './boot-state';

describe('TV boot presentation', () => {
  it.each(['startup', 'opening', 'reconnecting'] as const)(
    'keeps the %s surface visibly active',
    (phase) => {
      expect(tvBootPresentation(phase).active).toBe(true);
    },
  );

  it('does not promise activity for a build that cannot connect', () => {
    const state = tvBootPresentation('misconfigured');
    expect(state.active).toBe(false);
    expect(state.message).toContain('EXPO_PUBLIC_CONVEX_URL');
    expect(state.message).toMatch(/rebuild/i);
  });

  it('gives every phase legible title and explanatory copy', () => {
    const phases: readonly TvBootPhase[] = [
      'startup',
      'opening',
      'reconnecting',
      'misconfigured',
    ];

    for (const phase of phases) {
      const state = tvBootPresentation(phase);
      expect(state.title.length).toBeGreaterThan(0);
      expect(state.message.length).toBeGreaterThan(0);
    }
  });
});
