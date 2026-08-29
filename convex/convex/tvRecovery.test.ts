import { AWAY_AFTER_MS, HEARTBEAT_INTERVAL_MS, ROOM_EXPIRY_MS } from '@huddle/domain';
import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from './_generated/api';
import schema from './schema';
import { registerRateLimiter } from '../test/fixtures';

const modules = import.meta.glob(['./**/*.*s', '!./**/*.d.ts', '!./**/*.test.*']);
type Backend = ReturnType<typeof convexTest>;

function backend(): Backend {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  return t;
}

async function startProof(t: Backend, code: string) {
  const host = await t.mutation(api.players.joinRoom, { code, nickname: 'Ada', avatar: 'fox' });
  const guest = await t.mutation(api.players.joinRoom, {
    code,
    nickname: 'Grace',
    avatar: 'green-alien',
  });
  await t.mutation(api.games.selectGame, { sessionToken: host.sessionToken, gameId: 'trivia' });
  await t.mutation(api.games.finalizeGameSetup, { sessionToken: host.sessionToken });
  await t.mutation(api.games.setGameReady, { sessionToken: host.sessionToken, ready: true });
  await t.mutation(api.games.setGameReady, { sessionToken: guest.sessionToken, ready: true });
  await t.mutation(api.games.startGame, { sessionToken: host.sessionToken });
  return { host, guest };
}

describe('durable TV room recovery', () => {
  afterEach(() => vi.useRealTimers());

  it('opens one room idempotently for a durable token', async () => {
    const t = backend();
    const first = await t.mutation(api.rooms.openRoom, { tvSessionToken: 'tv-session-a' });
    const second = await t.mutation(api.rooms.openRoom, { tvSessionToken: 'tv-session-a' });
    expect(first).toMatchObject({ restored: false, hasRunningGame: false });
    expect(second).toMatchObject({
      roomId: first.roomId,
      code: first.code,
      restored: true,
      hasRunningGame: false,
    });
    expect(await t.run(async (ctx) => (await ctx.db.query('rooms').collect()).length)).toBe(1);
  });

  it('replaces a stale durable session without reporting a restoration', async () => {
    const t = backend();
    const first = await t.mutation(api.rooms.openRoom, {
      tvSessionToken: 'tv-stale-session',
    });

    await t.run(async (ctx) => {
      await ctx.db.delete(first.roomId);
    });

    const replacement = await t.mutation(api.rooms.openRoom, {
      tvSessionToken: 'tv-stale-session',
    });

    expect(replacement).toMatchObject({ restored: false, hasRunningGame: false });
    expect(replacement.roomId).not.toBe(first.roomId);
  });

  it('rate-limits new room credentials while allowing an existing restore', async () => {
    const t = backend();
    for (let index = 0; index < 20; index += 1) {
      await t.mutation(api.rooms.openRoom, { tvSessionToken: `tv-rate-${index}` });
    }
    await expect(
      t.mutation(api.rooms.openRoom, { tvSessionToken: 'tv-rate-over-capacity' }),
    ).rejects.toBeInstanceOf(ConvexError);
    await expect(
      t.mutation(api.rooms.openRoom, { tvSessionToken: 'tv-rate-0' }),
    ).resolves.toBeDefined();
  });

  it('marks the TV away after thirteen seconds', async () => {
    vi.useFakeTimers();
    const t = backend();
    const opened = await t.mutation(api.rooms.openRoom, { tvSessionToken: 'tv-session-b' });
    await vi.advanceTimersByTimeAsync(AWAY_AFTER_MS + 1);
    await t.finishInProgressScheduledFunctions();
    expect(await t.run(async (ctx) => (await ctx.db.get(opened.roomId))?.tvAway)).toBe(true);
  });

  it('keeps heartbeats on one room and expires it after ten minutes silent', async () => {
    vi.useFakeTimers();
    const t = backend();
    const token = 'tv-session-c';
    const opened = await t.mutation(api.rooms.openRoom, { tvSessionToken: token });
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    await t.mutation(api.rooms.tvHeartbeat, { tvSessionToken: token });
    expect(await t.mutation(api.rooms.openRoom, { tvSessionToken: token })).toMatchObject({
      roomId: opened.roomId,
      code: opened.code,
      restored: true,
      hasRunningGame: false,
    });
    await vi.advanceTimersByTimeAsync(ROOM_EXPIRY_MS + 1);
    await t.finishInProgressScheduledFunctions();
    expect(await t.query(api.rooms.stillOpen, { roomId: opened.roomId })).toBe(false);
  });

  it('hides a running proof state while the TV is away and restores it on heartbeat', async () => {
    vi.useFakeTimers();
    const t = backend();
    const token = 'tv-session-proof';
    const opened = await t.mutation(api.rooms.openRoom, { tvSessionToken: token });
    const { host, guest } = await startProof(t, opened.code);

    await vi.advanceTimersByTimeAsync(AWAY_AFTER_MS + 1);
    await t.mutation(api.players.heartbeat, { sessionToken: host.sessionToken });
    await t.mutation(api.players.heartbeat, { sessionToken: guest.sessionToken });
    await t.finishInProgressScheduledFunctions();
    expect(await t.query(api.games.running, { roomId: opened.roomId })).toMatchObject({
      kind: 'paused',
      reason: 'tvDisconnected',
    });

    await t.mutation(api.rooms.tvHeartbeat, { tvSessionToken: token });
    expect(await t.query(api.games.running, { roomId: opened.roomId })).toMatchObject({
      kind: 'running',
      state: { phase: 'entered' },
    });
    expect(await t.mutation(api.rooms.openRoom, { tvSessionToken: token })).toMatchObject({
      roomId: opened.roomId,
      code: opened.code,
      restored: true,
      hasRunningGame: true,
    });
  });
});
