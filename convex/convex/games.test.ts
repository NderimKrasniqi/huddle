import { AVATAR_IDS } from '@huddle/domain';
import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { describe, expect, it } from 'vitest';

import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';
import { roomFixture } from '../test/fixtures';

const modules = import.meta.glob(['./**/*.*s', '!./**/*.d.ts', '!./**/*.test.*']);
type Backend = ReturnType<typeof convexTest>;

async function party(t: Backend, gameId = 'trivia') {
  const room = await roomFixture(t);
  const host = await t.mutation(api.players.joinRoom, {
    code: room.code,
    nickname: 'Ada',
    avatar: AVATAR_IDS[0],
  });
  const guest = await t.mutation(api.players.joinRoom, {
    code: room.code,
    nickname: 'Grace',
    avatar: AVATAR_IDS[1],
  });
  await t.mutation(api.games.selectGame, { sessionToken: host.sessionToken, gameId });
  return { ...room, host: host.sessionToken, guest: guest.sessionToken };
}

async function lockAndReady(t: Backend, room: Awaited<ReturnType<typeof party>>) {
  await t.mutation(api.games.finalizeGameSetup, { sessionToken: room.host });
  await t.mutation(api.games.setGameReady, { sessionToken: room.host, ready: true });
  await t.mutation(api.games.setGameReady, { sessionToken: room.guest, ready: true });
}

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
    throw new Error('expected a structured rejection');
  } catch (error) {
    if (!(error instanceof ConvexError)) throw error;
    return error.data;
  }
}

describe('locked setup and readiness', () => {
  it('requires a locked setup and every seated player, including Host, to Ready', async () => {
    const t = convexTest(schema, modules);
    const room = await party(t);

    expect(await rejection(t.mutation(api.games.startGame, { sessionToken: room.host }))).toEqual({
      kind: 'setupNotReady',
    });

    await t.mutation(api.games.finalizeGameSetup, { sessionToken: room.host });
    expect(await rejection(t.mutation(api.games.startGame, { sessionToken: room.host }))).toEqual({
      kind: 'playersNotReady',
      playerIds: expect.any(Array),
    });

    await t.mutation(api.games.setGameReady, { sessionToken: room.guest, ready: true });
    const missingHost = await rejection(t.mutation(api.games.startGame, { sessionToken: room.host }));
    expect(missingHost).toMatchObject({ kind: 'playersNotReady' });

    await t.mutation(api.games.setGameReady, { sessionToken: room.host, ready: true });
    await expect(t.mutation(api.games.startGame, { sessionToken: room.host })).resolves.toBeNull();
  });

  it('locks settings, and reopening clears every Ready flag', async () => {
    const t = convexTest(schema, modules);
    const room = await party(t);
    await lockAndReady(t, room);

    expect(
      await rejection(
        t.mutation(api.games.configureGame, {
          sessionToken: room.host,
          settings: { questions: '5' },
        }),
      ),
    ).toEqual({ kind: 'setupLocked' });

    await t.mutation(api.games.reopenGameSetup, { sessionToken: room.host });
    expect(await t.query(api.games.setup, { roomId: room.roomId })).toMatchObject({
      stage: 'configuring',
      readyPlayerIds: [],
    });
  });

  it('makes a new arrival unready and removes readiness when a seat leaves', async () => {
    const t = convexTest(schema, modules);
    const room = await party(t);
    await lockAndReady(t, room);
    const third = await t.mutation(api.players.joinRoom, {
      code: room.code,
      nickname: 'Lin',
      avatar: AVATAR_IDS[2],
    });

    expect(await rejection(t.mutation(api.games.startGame, { sessionToken: room.host }))).toMatchObject({
      kind: 'playersNotReady',
    });

    await t.mutation(api.games.setGameReady, { sessionToken: third.sessionToken, ready: true });
    await t.mutation(api.players.leaveRoom, { sessionToken: third.sessionToken });
    await expect(t.mutation(api.games.startGame, { sessionToken: room.host })).resolves.toBeNull();
  });
});

describe.each([
  ['trivia', 'questions', 10],
  ['voting', 'rounds', 5],
] as const)('%s launch proof', (gameId, setting, resolvedValue) => {
  it('launches module-owned entered state and returns everyone to the same lobby', async () => {
    const t = convexTest(schema, modules);
    const room = await party(t, gameId);
    await lockAndReady(t, room);
    await t.mutation(api.games.startGame, { sessionToken: room.host });

    const running = await t.query(api.games.running, { roomId: room.roomId });
    expect(running).toMatchObject({
      kind: 'running',
      gameId,
      state: { phase: 'entered', resolvedSettings: { [setting]: resolvedValue } },
    });

    await t.mutation(api.games.endGame, { sessionToken: room.host });
    expect(await t.query(api.games.running, { roomId: room.roomId })).toBeNull();
    expect(await t.query(api.games.setup, { roomId: room.roomId })).toBeNull();
    expect((await t.query(api.players.roster, { roomId: room.roomId }))?.length).toBe(2);
  });
});

describe('presence at Start', () => {
  it('blocks an away seated player while retaining their Ready flag', async () => {
    const t = convexTest(schema, modules);
    const room = await party(t);
    await lockAndReady(t, room);
    await t.run(async (ctx) => {
      const player = (await ctx.db.query('players').collect()).find(
        (candidate) => candidate.sessionToken === room.guest,
      );
      if (player === undefined) throw new Error('guest seat missing');
      await ctx.db.patch(player._id as Id<'players'>, { away: true });
    });

    expect(await rejection(t.mutation(api.games.startGame, { sessionToken: room.host }))).toMatchObject({
      kind: 'playersAway',
    });
    expect((await t.query(api.games.setup, { roomId: room.roomId }))?.readyPlayerIds.length).toBe(2);
  });
});
