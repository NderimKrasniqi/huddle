import { MINUTE, SECOND } from '@convex-dev/rate-limiter';
import { describe, expect, it } from 'vitest';

import { RATE_LIMITS } from './rate-limits';

describe('party-safe rate-limit policy', () => {
  it('pins every documented token bucket', () => {
    expect(RATE_LIMITS).toEqual({
      roomOpen: { kind: 'token bucket', rate: 10, period: MINUTE, capacity: 20 },
      joinGlobal: { kind: 'token bucket', rate: 600, period: MINUTE, capacity: 1_200 },
      joinRoom: { kind: 'token bucket', rate: 120, period: MINUTE, capacity: 240 },
      joinGuest: { kind: 'token bucket', rate: 60, period: MINUTE, capacity: 120 },
      memberCommand: { kind: 'token bucket', rate: 180, period: MINUTE, capacity: 360 },
      hostCommand: { kind: 'token bucket', rate: 120, period: MINUTE, capacity: 240 },
      tvCommand: { kind: 'token bucket', rate: 120, period: MINUTE, capacity: 240 },
      gameEvent: { kind: 'token bucket', rate: 30, period: SECOND, capacity: 60 },
    });
  });
});
