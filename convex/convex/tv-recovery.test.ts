import { AWAY_AFTER_MS, HEARTBEAT_INTERVAL_MS, ROOM_EXPIRY_MS } from '@huddle/game-core';
import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';
import rateLimiterSchema from '../node_modules/@convex-dev/rate-limiter/dist/component/schema.js';

const modules = import.meta.glob(['./**/*.*s', '!./**/*.d.ts', '!./**/*.test.*']);
const rateLimiterModules = import.meta.glob(
  '../node_modules/@convex-dev/rate-limiter/dist/component/**/*.js',
);
type Backend = ReturnType<typeof convexTest>;

function backend(): Backend {
  const t = convexTest(schema, modules);
  t.registerComponent('rateLimiter', rateLimiterSchema, rateLimiterModules);
  return t;
}

async function roomRow(t: Backend, roomId: Id<'rooms'>) {
  return await t.run(async (ctx) => await ctx.db.get(roomId));
}

/** Let time pass while only the named clients keep their presence alive. */
async function elapsePresent(
  t: Backend,
  players: readonly string[],
  tvSessionToken: string | undefined,
  ms: number,
): Promise<void> {
  let elapsed = 0;

  while (elapsed < ms) {
    const step = Math.min(HEARTBEAT_INTERVAL_MS, ms - elapsed);
    await vi.advanceTimersByTimeAsync(step);
    for (const sessionToken of players) {
      await t.mutation(api.players.heartbeat, { sessionToken });
    }
    if (tvSessionToken !== undefined) {
      await t.mutation(api.rooms.tvHeartbeat, { tvSessionToken });
    }
    await t.finishInProgressScheduledFunctions();
    elapsed += step;
  }
}

/** Away checks still pending for the one TV credential. */
async function pendingTvAwayChecks(t: Backend, sessionToken: string): Promise<number> {
  return await t.run(async (ctx) => {
    const session = (await ctx.db.query('tvSessions').collect()).find(
      (candidate) => candidate.sessionToken === sessionToken,
    );
    if (session === undefined) return 0;

    const scheduled = await ctx.db.system.query('_scheduled_functions').collect();
    return scheduled.filter((job) => {
      const [args] = job.args as [{ readonly tvSessionId?: Id<'tvSessions'> }];
      return (
        job.state.kind === 'pending' &&
        args.tvSessionId === session._id &&
        job.name.endsWith(':markTvAway')
      );
    }).length;
  });
}

describe('durable TV room recovery', () => {
  afterEach(() => vi.useRealTimers());

  it('opens one room idempotently for a durable token', async () => {
    const t = backend();
    const token = 'tv-session-a';

    const first = await t.mutation(api.rooms.openRoom, { tvSessionToken: token });
    const second = await t.mutation(api.rooms.openRoom, { tvSessionToken: token });

    expect(second).toEqual(first);
    expect(await t.run(async (ctx) => (await ctx.db.query('rooms').collect()).length)).toBe(1);
    expect(
      await t.run(async (ctx) => (await ctx.db.query('tvSessions').collect()).length),
    ).toBe(1);
  });

  it('limits only new credentials while allowing a restore', async () => {
    const t = backend();
    for (let index = 0; index < 20; index += 1) {
      await t.mutation(api.rooms.openRoom, { tvSessionToken: `tv-rate-${index}` });
    }

    await expect(
      t.mutation(api.rooms.openRoom, { tvSessionToken: 'tv-rate-over-capacity' }),
    ).rejects.toBeInstanceOf(ConvexError);
    await expect(t.mutation(api.rooms.openRoom, { tvSessionToken: 'tv-rate-0' })).resolves.toBeDefined();
  });

  it('marks away after thirteen seconds and keeps the exact game remainder', async () => {
    vi.useFakeTimers();
    const t = backend();
    const opened = await t.mutation(api.rooms.openRoom, { tvSessionToken: 'tv-session-b' });

    await t.run(async (ctx) => {
      await ctx.db.patch(opened.roomId, {
        game: {
          gameId: 'trivia',
          stateVersion: 1,
          state: { invalid: true },
          deadlineAt: Date.now() + 20_500,
        },
      });
    });

    await vi.advanceTimersByTimeAsync(AWAY_AFTER_MS + 1);
    const room = await roomRow(t, opened.roomId);

    expect(room?.tvAway).toBe(true);
    expect(room?.game?.pausedRemainingMs).toBe(7_500);
    expect(room?.game?.deadline).toBeUndefined();
  });

  it('keeps heartbeats from creating a second room and expires after ten minutes silent', async () => {
    vi.useFakeTimers();
    const t = backend();
    const token = 'tv-session-c';
    const opened = await t.mutation(api.rooms.openRoom, { tvSessionToken: token });

    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    await t.mutation(api.rooms.tvHeartbeat, { tvSessionToken: token });
    expect(await t.mutation(api.rooms.openRoom, { tvSessionToken: token })).toEqual(opened);

    await vi.advanceTimersByTimeAsync(ROOM_EXPIRY_MS + 1);
    expect(await t.query(api.rooms.stillOpen, { roomId: opened.roomId })).toBe(false);
  });

  it('keeps one away-check chain while a connected TV keeps beating and reopening', async () => {
    vi.useFakeTimers();
    const t = backend();
    const token = 'tv-session-single-watch';
    const opened = await t.mutation(api.rooms.openRoom, { tvSessionToken: token });

    expect(await pendingTvAwayChecks(t, token)).toBe(1);

    for (let beat = 0; beat < 8; beat += 1) {
      await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
      await t.mutation(api.rooms.tvHeartbeat, { tvSessionToken: token });
      expect(await t.mutation(api.rooms.openRoom, { tvSessionToken: token })).toEqual(opened);
      expect(await pendingTvAwayChecks(t, token)).toBe(1);
    }
  });

  it('collapses duplicate checks left by an older deployment into one chain', async () => {
    vi.useFakeTimers();
    const t = backend();
    const token = 'tv-session-legacy-watchers';
    await t.mutation(api.rooms.openRoom, { tvSessionToken: token });

    await t.run(async (ctx) => {
      const session = (await ctx.db.query('tvSessions').collect()).find(
        (candidate) => candidate.sessionToken === token,
      );
      if (session === undefined) throw new Error('expected a TV session');

      // Old heartbeat code scheduled a fresh check every three seconds and
      // carried no generation. Model three of those callbacks surviving a
      // deployment, alongside the modern check created with this room.
      await ctx.db.patch(session._id, { awayCheckGeneration: undefined });
      for (let duplicate = 0; duplicate < 3; duplicate += 1) {
        await ctx.scheduler.runAfter(1, internal.rooms.markTvAway, {
          tvSessionId: session._id,
        });
      }
    });

    await vi.advanceTimersByTimeAsync(1);
    await t.finishInProgressScheduledFunctions();
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS - 1);
    await t.mutation(api.rooms.tvHeartbeat, { tvSessionToken: token });
    await vi.advanceTimersByTimeAsync(AWAY_AFTER_MS - HEARTBEAT_INTERVAL_MS);
    await t.finishInProgressScheduledFunctions();

    expect(await pendingTvAwayChecks(t, token)).toBe(1);
  });

  it('pauses gameplay while away and rejects a new start without exposing state', async () => {
    vi.useFakeTimers();
    const t = backend();
    const token = 'tv-session-d';
    const opened = await t.mutation(api.rooms.openRoom, { tvSessionToken: token });
    const host = await t.mutation(api.players.joinRoom, {
      code: opened.code,
      nickname: 'Ada',
      avatar: 'fox',
    });
    const guest = await t.mutation(api.players.joinRoom, {
      code: opened.code,
      nickname: 'Grace',
      avatar: 'green-alien',
    });
    await t.mutation(api.games.startGame, { sessionToken: host.sessionToken, gameId: 'trivia' });

    await elapsePresent(
      t,
      [host.sessionToken, guest.sessionToken],
      undefined,
      AWAY_AFTER_MS + 1,
    );
    await expect(t.query(api.games.running, { roomId: opened.roomId })).resolves.toMatchObject({
      kind: 'paused',
      gameId: 'trivia',
      reason: 'tvDisconnected',
    });

    await expect(
      t.mutation(api.games.startGame, { sessionToken: host.sessionToken, gameId: 'trivia' }),
    ).rejects.toBeInstanceOf(ConvexError);
    await t.mutation(api.games.sendEvent, {
      sessionToken: host.sessionToken,
      event: { kind: 'answer', questionIndex: 0, optionIndex: 0 },
    });
    expect(await t.query(api.games.running, { roomId: opened.roomId })).toMatchObject({
      kind: 'paused',
      gameId: 'trivia',
    });
  });

  it('restores the same room and exact paused remainder on heartbeat', async () => {
    vi.useFakeTimers();
    const t = backend();
    const token = 'tv-session-e';
    const opened = await t.mutation(api.rooms.openRoom, { tvSessionToken: token });
    const host = await t.mutation(api.players.joinRoom, {
      code: opened.code,
      nickname: 'Ada',
      avatar: 'fox',
    });
    const guest = await t.mutation(api.players.joinRoom, {
      code: opened.code,
      nickname: 'Grace',
      avatar: 'green-alien',
    });
    await t.mutation(api.games.startGame, { sessionToken: host.sessionToken, gameId: 'trivia' });

    await elapsePresent(
      t,
      [host.sessionToken, guest.sessionToken],
      undefined,
      AWAY_AFTER_MS + 1,
    );
    const paused = await roomRow(t, opened.roomId);
    const remainder = paused?.game?.pausedRemainingMs;
    expect(remainder).toBeGreaterThan(0);

    await t.mutation(api.rooms.tvHeartbeat, { tvSessionToken: token });
    const restored = await roomRow(t, opened.roomId);
    expect(restored?.tvAway).toBe(false);
    expect(restored?.game?.pausedRemainingMs).toBeUndefined();
    expect((restored?.game?.deadlineAt ?? 0) - Date.now()).toBe(remainder);
    expect(await t.mutation(api.rooms.openRoom, { tvSessionToken: token })).toEqual(opened);
  });

  it('preserves one remainder while player and TV pauses overlap', async () => {
    vi.useFakeTimers();
    const t = backend();
    const token = 'tv-session-overlapping-pauses';
    const opened = await t.mutation(api.rooms.openRoom, { tvSessionToken: token });
    const host = await t.mutation(api.players.joinRoom, {
      code: opened.code,
      nickname: 'Ada',
      avatar: 'fox',
    });
    await t.mutation(api.players.joinRoom, {
      code: opened.code,
      nickname: 'Grace',
      avatar: 'green-alien',
    });
    await t.mutation(api.games.startGame, { sessionToken: host.sessionToken, gameId: 'trivia' });

    // Grace disconnects first while Ada and the TV remain present.
    await elapsePresent(t, [host.sessionToken], token, AWAY_AFTER_MS + 1);
    const playerPaused = await roomRow(t, opened.roomId);
    const remainder = playerPaused?.game?.pausedRemainingMs;
    expect(remainder).toBeGreaterThan(0);
    expect(await t.query(api.games.running, { roomId: opened.roomId })).toMatchObject({
      kind: 'paused',
      reason: 'playerDisconnected',
    });

    // The TV then disconnects too. Its pause must not overwrite the captured
    // remainder with zero, and it takes display precedence while it is away.
    await elapsePresent(t, [host.sessionToken], undefined, AWAY_AFTER_MS + 1);
    const bothPaused = await roomRow(t, opened.roomId);
    expect(bothPaused?.game?.pausedRemainingMs).toBe(remainder);
    expect(await t.query(api.games.running, { roomId: opened.roomId })).toMatchObject({
      kind: 'paused',
      reason: 'tvDisconnected',
    });

    await t.mutation(api.rooms.tvHeartbeat, { tvSessionToken: token });
    const tvReturned = await roomRow(t, opened.roomId);
    expect(tvReturned?.game?.deadlineAt).toBeUndefined();
    expect(tvReturned?.game?.pausedRemainingMs).toBe(remainder);
    expect(await t.query(api.games.running, { roomId: opened.roomId })).toMatchObject({
      kind: 'paused',
      reason: 'playerDisconnected',
    });

    await t.mutation(api.games.continueAfterDisconnect, {
      sessionToken: host.sessionToken,
    });
    const continued = await roomRow(t, opened.roomId);
    expect((continued?.game?.deadlineAt ?? 0) - Date.now()).toBe(remainder);
    expect(await t.query(api.games.running, { roomId: opened.roomId })).toMatchObject({
      kind: 'running',
    });
  });
});
