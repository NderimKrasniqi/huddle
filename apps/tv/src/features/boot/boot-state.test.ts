import { describe, expect, it } from 'vitest';

import {
  tvBootAnimationCopy,
  tvBootPresentation,
  type TvAnimatedBootPhase,
  type TvBootPhase,
} from './boot-state';

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

  it('keeps active animation copy phase-specific', () => {
    const expected: Record<TvAnimatedBootPhase, { title: string; subtitle: string }> = {
      startup: {
        title: 'Starting Huddle…',
        subtitle: 'Getting things ready',
      },
      opening: {
        title: 'Creating your room…',
        subtitle: 'Setting things up',
      },
      reconnecting: {
        title: 'Reconnecting to room…',
        subtitle: 'Getting everyone back',
      },
    };

    for (const phase of Object.keys(expected) as TvAnimatedBootPhase[]) {
      expect(tvBootAnimationCopy(phase)).toEqual(expected[phase]);
    }
  });
});
