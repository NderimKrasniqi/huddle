import { describe, expect, it } from 'vitest';

import { AWAY_AFTER_MS } from './presence';
import { ROOM_EXPIRY_MS, UNJOINED_ROOM_EXPIRY_MS } from './room-expiry';

/**
 * The scope's rule for a room outliving its party: "room expires after everyone
 * leaves", at the plan's pinned ten minutes.
 *
 * The ten minutes are spelled out here rather than imported, because they are
 * the product decision and the constant is the implementation of it — the same
 * split `presence.test.ts` makes for the away deadline.
 */
describe('room expiry timing', () => {
  it('gives a deserted room the plan’s ten minutes', () => {
    expect(ROOM_EXPIRY_MS).toBe(10 * 60 * 1_000);
  });

  it('leaves a party far longer than the room takes to notice they have gone', () => {
    // The clock runs from the last heartbeat the room heard, and the room only
    // learns of the silence `AWAY_AFTER_MS` into it. Numbers of comparable size
    // would spend a visible part of the ten minutes on the noticing — and, in
    // the other direction, an expiry shorter than the away deadline would delete
    // a room out from under a party that had merely put their phones down.
    expect(ROOM_EXPIRY_MS).toBeGreaterThan(10 * AWAY_AFTER_MS);
  });
});

/** The retired value remains stable for callers that still import it. */
describe('legacy unjoined-room expiry export', () => {
  it('preserves its two-hour package value', () => {
    expect(UNJOINED_ROOM_EXPIRY_MS).toBe(2 * 60 * 60 * 1_000);
  });

  it('remains distinct from the active deserted-room lifetime', () => {
    expect(UNJOINED_ROOM_EXPIRY_MS).toBeGreaterThan(10 * ROOM_EXPIRY_MS);
  });
});
