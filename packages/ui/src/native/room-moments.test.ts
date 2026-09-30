import { describe, expect, it } from 'vitest';
import { advanceRoomMoments, INITIAL_ROOM_MOMENTS, type RoomMomentSnapshot, type RoomMoments } from './room-moments';

const lobby: RoomMomentSnapshot = { playerIds: [], runtime: 'lobby', lobbyResolved: true, browsing: false, now: 1000 };
function next(previous: RoomMoments, changes: Partial<RoomMomentSnapshot> = {}) {
  return advanceRoomMoments(previous, { ...lobby, ...changes });
}

describe('room presentation moments', () => {
  it('waits for a resolved roster and suppresses restored seats', () => {
    const pending = next(INITIAL_ROOM_MOMENTS, { playerIds: undefined, lobbyResolved: false });
    expect(pending.seenIds).toBeUndefined();
    const restored = next(pending, { playerIds: ['ada'] });
    expect(restored.welcomeIds).toEqual([]);
    expect(restored.returned).toBe(false);
  });
  it('welcomes confirmed additions together for 4.6 seconds', () => {
    const initial = next(INITIAL_ROOM_MOMENTS);
    const joined = next(initial, { playerIds: ['ada', 'sam'] });
    expect(joined.welcomeIds).toEqual(['ada', 'sam']);
    expect(joined.welcomeUntil).toBe(5600);
    expect(next(joined, { playerIds: ['ada', 'sam'], now: 5599 }).welcomeIds).toHaveLength(2);
    expect(next(joined, { playerIds: ['ada', 'sam'], now: 5600 }).welcomeIds).toEqual([]);
  });
  it('does not replay a welcome on edits, reconnect, or the same seat reappearing', () => {
    const initial = next(INITIAL_ROOM_MOMENTS, { playerIds: ['ada'] });
    const left = next(initial);
    expect(next(left, { playerIds: ['ada'] }).welcomeIds).toEqual([]);
    expect(next(initial, { playerIds: ['ada'] }).welcomeIds).toEqual([]);
  });
  it('does not defer gameplay or countdown arrivals into a later welcome', () => {
    const initial = next(INITIAL_ROOM_MOMENTS);
    const game = next(initial, { playerIds: ['ada'], runtime: 'game', lobbyResolved: false });
    expect(game.welcomeIds).toEqual([]);
    expect(next(game, { playerIds: ['ada'] }).welcomeIds).toEqual([]);
    const countdown = next(initial, { playerIds: ['sam'], browsing: true, lobbyResolved: false });
    expect(next(countdown, { playerIds: ['sam'] }).welcomeIds).toEqual([]);
  });
  it('holds the finish transition through stale subscriptions, then stays until browsing', () => {
    const finished = next(INITIAL_ROOM_MOMENTS, { runtime: 'finished', lobbyResolved: false, browsing: true });
    const pending = next(finished, { lobbyResolved: false, browsing: true });
    expect(pending.returned).toBe(false);
    expect(pending.finishedSeen).toBe(true);
    const returned = next(pending);
    expect(returned.returned).toBe(true);
    expect(next(returned, { now: 999999 }).returned).toBe(true);
    const browsing = next(returned, { browsing: true, lobbyResolved: false });
    expect(browsing.returned).toBe(false);
    expect(next(browsing).returned).toBe(false);
  });
  it('does not celebrate initial loading, cancellation, or a paused game ending', () => {
    for (const runtime of ['lobby', 'paused', 'unavailable', 'game'] as const) {
      const previous = next(INITIAL_ROOM_MOMENTS, { runtime, lobbyResolved: false });
      expect(next(previous).returned).toBe(false);
    }
  });
});
