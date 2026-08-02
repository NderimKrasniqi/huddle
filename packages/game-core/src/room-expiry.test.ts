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

/**
 * The other clock: how long a room nobody has joined is held for the television
 * showing its code.
 *
 * A deserted room's ten minutes cannot answer this one — a room with no players
 * has no last heartbeat to count from — so it is a second number and not a reuse
 * of the first. Spelled out here for the reason the ten minutes are: this is the
 * product decision, and the constant is its implementation.
 */
describe('unjoined room expiry timing', () => {
  it('gives a television showing a code to nobody two hours of it', () => {
    expect(UNJOINED_ROOM_EXPIRY_MS).toBe(2 * 60 * 60 * 1_000);
  });

  it('holds an unjoined room far longer than a room whose party has left', () => {
    // The two answer opposite questions. Ten minutes is how long a room waits
    // for a party it has already met to come back; this is how long it waits for
    // one that has never arrived, and getting it wrong takes a Room Code off a
    // screen somebody is reading it from. So it is not merely longer — it is
    // longer by an order of magnitude, which is what makes it a window only a
    // television nobody is playing on can reach.
    expect(UNJOINED_ROOM_EXPIRY_MS).toBeGreaterThan(10 * ROOM_EXPIRY_MS);
  });
});
