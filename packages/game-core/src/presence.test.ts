import { describe, expect, it } from 'vitest';

import { AWAY_AFTER_MS, HEARTBEAT_INTERVAL_MS } from './presence';

/**
 * The scope's presence rule, as arithmetic: "phone backgrounded ≥10s → the TV
 * roster marks that player away within a further 5s".
 *
 * A phone stops beating the moment it goes to the background, so how long the
 * room then waits *is* the whole of that promise — and the two numbers it is
 * made of are checkable here, rather than by backgrounding an app with a
 * stopwatch in the other hand. The seconds are spelled out rather than imported
 * because they are the product decision; the constants are the implementation
 * of it.
 */
describe('presence timings', () => {
  it('never calls a player away before they have been gone ten seconds', () => {
    // A phone can go quiet immediately after a beat or just before the next one
    // is due, so the earliest the room can act is one beat sooner than the
    // silence it waits for. That earliest moment is the one the scope bounds.
    expect(AWAY_AFTER_MS - HEARTBEAT_INTERVAL_MS).toBeGreaterThanOrEqual(10_000);
  });

  it('calls them away within five seconds of that', () => {
    expect(AWAY_AFTER_MS).toBeLessThanOrEqual(15_000);
  });

  it('lets a run of beats go missing without unseating anybody', () => {
    // Beats are mutations over somebody's house wifi. Three in a row may fail
    // to land and the fourth still arrives before the room gives up on a player
    // who never moved.
    expect(AWAY_AFTER_MS).toBeGreaterThan(4 * HEARTBEAT_INTERVAL_MS);
  });
});
