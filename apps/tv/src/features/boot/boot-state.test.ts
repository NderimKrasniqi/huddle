import { describe, expect, it } from 'vitest';

import { tvBootPresentation, type TvBootPhase } from './boot-state';

describe('TV boot purposes', () => {
  it('maps every pre-room phase to one exact label', () => {
    const expected: Record<TvBootPhase, string> = {
      startup: 'Starting Huddle',
      opening: 'Creating a room',
      reconnecting: 'Reconnecting to room',
      misconfigured: 'TV setup required',
      deviceFailure: 'TV unavailable',
    };

    for (const phase of Object.keys(expected) as TvBootPhase[]) {
      expect(tvBootPresentation(phase).purpose).toBe(expected[phase]);
    }
  });
});
