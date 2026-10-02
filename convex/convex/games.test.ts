import { AVATAR_IDS, COUNTDOWN_MS } from '@huddle/domain';
import { gameLogicById } from '@huddle/game-registry/logic';
import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';
import { INTRO_SECONDS } from '@huddle/game-trivia/logic';
import { roomFixture, tvRunning } from '../test/fixtures';

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
  it('returns every client to the lobby by clearing the draft and shared browse index', async () => {
    const t = convexTest(schema, modules);
    const room = await party(t);

    expect(await t.query(api.games.setup, { roomId: room.roomId })).not.toBeNull();
    expect(await t.query(api.games.browsing, { roomId: room.roomId })).toBe(0);

    await t.mutation(api.games.cancelGameSetup, { sessionToken: room.host });

    expect(await t.query(api.games.setup, { roomId: room.roomId })).toBeNull();
    expect(await t.query(api.games.browsing, { roomId: room.roomId })).toBeNull();
  });

  it('requires a locked setup and every seated player, including Host, to Ready', async () => {
    const t = convexTest(schema, modules);
    const room = await party(t);

    expect(await rejection(t.mutation(api.games.startGame, { sessionToken: room.host }))).toEqual({
      kind: 'setupNotReady',
    });

    // Locking the settings starts the ready check with the Host already Ready.
    await t.mutation(api.games.finalizeGameSetup, { sessionToken: room.host });
    expect((await t.query(api.games.setup, { roomId: room.roomId }))?.readyPlayerIds).toHaveLength(1);
    expect(await rejection(t.mutation(api.games.startGame, { sessionToken: room.host }))).toEqual({
      kind: 'playersNotReady',
      playerIds: expect.any(Array),
    });

    await t.mutation(api.games.setGameReady, { sessionToken: room.guest, ready: true });
    await t.mutation(api.games.setGameReady, { sessionToken: room.host, ready: false });
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
] as const)('%s playable launch', (gameId, setting, resolvedValue) => {
  it('launches module-owned initial state and returns everyone to the same lobby', async () => {
    const t = convexTest(schema, modules);
    const room = await party(t, gameId);
    await t.mutation(api.games.browseGame, { sessionToken: room.host, index: 4 });
    await lockAndReady(t, room);
    await t.mutation(api.games.startGame, { sessionToken: room.host });

    const running = await tvRunning(t, room.roomId);
    expect(running).toMatchObject({ kind: 'running', gameId });
    expect(await t.query(api.games.browsing, { roomId: room.roomId })).toBe(4);

    // Both installed modules own a playable v2 opening beat. The public
    // projection exposes the server-owned intro clock and settled setup while
    // each module keeps its content and rules behind the generic game seam.
    expect(running).toMatchObject({
      state: { phase: 'intro' },
      settings: { [setting]: String(resolvedValue) },
      clockRemainingMs: expect.any(Number),
    });
    expect(running?.kind === 'running' ? running.clockRemainingMs : undefined).toBeGreaterThan(0);

    await t.mutation(api.games.endGame, { sessionToken: room.host });
    expect(await tvRunning(t, room.roomId)).toBeNull();
    expect(await t.query(api.games.setup, { roomId: room.roomId })).toBeNull();
    expect(await t.query(api.games.browsing, { roomId: room.roomId })).toBeNull();
    expect((await t.query(api.players.roster, { roomId: room.roomId }))?.length).toBe(2);
  });
});

describe('who is shown a running game', () => {
  async function tvToken(t: Backend, roomId: Id<'rooms'>, token: string) {
    await t.run(async (ctx) =>
      await ctx.db.insert('tvSessions', { roomId, sessionToken: token, lastSeenAt: Date.now(), away: false }),
    );
    return token;
  }

  async function started(t: Backend) {
    const room = await party(t);
    await lockAndReady(t, room);
    await t.mutation(api.games.startGame, { sessionToken: room.host });
    return room;
  }

  it('shows the game to this room\'s TV and its seated players', async () => {
    const t = convexTest(schema, modules);
    const room = await started(t);
    const tvSessionToken = await tvToken(t, room.roomId, 'tv-here');

    expect(await t.query(api.games.running, { roomId: room.roomId, tvSessionToken })).toMatchObject({ kind: 'running' });
    expect(await t.query(api.games.running, { roomId: room.roomId, sessionToken: room.guest })).toMatchObject({ kind: 'running' });
  });

  it('shows nothing to a caller who is neither, rather than the TV\'s shared screen', async () => {
    const t = convexTest(schema, modules);
    const room = await started(t);
    const elsewhere = await party(t);
    const foreignTv = await tvToken(t, elsewhere.roomId, 'tv-elsewhere');
    const leaver = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Lin', avatar: AVATAR_IDS[2] });
    await t.mutation(api.players.leaveRoom, { sessionToken: leaver.sessionToken });

    const unavailable = { kind: 'unavailable', gameId: 'trivia' };
    expect(await t.query(api.games.running, { roomId: room.roomId })).toEqual(unavailable);
    expect(await t.query(api.games.running, { roomId: room.roomId, tvSessionToken: foreignTv })).toEqual(unavailable);
    expect(await t.query(api.games.running, { roomId: room.roomId, sessionToken: elsewhere.host })).toEqual(unavailable);
    expect(await t.query(api.games.running, { roomId: room.roomId, sessionToken: leaver.sessionToken })).toEqual(unavailable);
  });
});

describe('the countdown before a game', () => {
  afterEach(() => vi.useRealTimers());

  async function setupOf(t: Backend, roomId: Id<'rooms'>) {
    return await t.query(api.games.setup, { roomId });
  }

  async function runningOf(t: Backend, roomId: Id<'rooms'>) {
    return await tvRunning(t, roomId);
  }

  async function countdownEnds(t: Backend) {
    await vi.advanceTimersByTimeAsync(COUNTDOWN_MS + 1);
    await t.finishInProgressScheduledFunctions();
  }

  it('is refused until everyone is Ready', async () => {
    const t = convexTest(schema, modules);
    const room = await party(t);
    await t.mutation(api.games.finalizeGameSetup, { sessionToken: room.host });

    expect(await rejection(t.mutation(api.games.startCountdown, { sessionToken: room.host }))).toMatchObject({
      kind: 'playersNotReady',
    });
    expect((await setupOf(t, room.roomId))?.stage).toBe('ready');
  });

  it('is the Host’s alone to start', async () => {
    const t = convexTest(schema, modules);
    const room = await party(t);
    await lockAndReady(t, room);

    expect(await rejection(t.mutation(api.games.startCountdown, { sessionToken: room.guest }))).toMatchObject({
      kind: 'notHost',
    });
  });

  it('starts the game when it runs out', async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const room = await party(t);
    await lockAndReady(t, room);

    await t.mutation(api.games.startCountdown, { sessionToken: room.host });
    const counting = await setupOf(t, room.roomId);
    expect(counting).toMatchObject({ stage: 'countdown', countdownEndsAt: expect.any(Number) });
    expect(await runningOf(t, room.roomId)).toBeNull();

    // A second tap during the countdown changes nothing.
    await t.mutation(api.games.startCountdown, { sessionToken: room.host });
    expect((await setupOf(t, room.roomId))?.countdownEndsAt).toBe(counting?.countdownEndsAt);

    await countdownEnds(t);
    expect(await setupOf(t, room.roomId)).toBeNull();
    expect(await runningOf(t, room.roomId)).toMatchObject({ kind: 'running', gameId: 'trivia' });
  });

  it('stops when a player un-readies, keeping everyone else Ready', async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const room = await party(t);
    await lockAndReady(t, room);
    await t.mutation(api.games.startCountdown, { sessionToken: room.host });

    await t.mutation(api.games.setGameReady, { sessionToken: room.guest, ready: false });
    const setup = await setupOf(t, room.roomId);
    expect(setup).toMatchObject({ stage: 'ready' });
    expect(setup?.countdownEndsAt).toBeUndefined();
    expect(setup?.readyPlayerIds).toHaveLength(1);

    await countdownEnds(t);
    expect(await runningOf(t, room.roomId)).toBeNull();
  });

  it('stops when the Host stops it', async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const room = await party(t);
    await lockAndReady(t, room);
    await t.mutation(api.games.startCountdown, { sessionToken: room.host });

    await t.mutation(api.games.stopCountdown, { sessionToken: room.host });
    expect((await setupOf(t, room.roomId))?.stage).toBe('ready');
    await countdownEnds(t);
    expect(await runningOf(t, room.roomId)).toBeNull();

    // And starts again from the full five seconds.
    await t.mutation(api.games.startCountdown, { sessionToken: room.host });
    await countdownEnds(t);
    expect(await runningOf(t, room.roomId)).toMatchObject({ kind: 'running' });
  });

  it('stops when somebody joins or leaves', async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const room = await party(t);
    await lockAndReady(t, room);
    await t.mutation(api.games.startCountdown, { sessionToken: room.host });

    const third = await t.mutation(api.players.joinRoom, {
      code: room.code,
      nickname: 'Lin',
      avatar: AVATAR_IDS[2],
    });
    expect((await setupOf(t, room.roomId))?.stage).toBe('ready');

    await t.mutation(api.games.setGameReady, { sessionToken: third.sessionToken, ready: true });
    await t.mutation(api.games.startCountdown, { sessionToken: room.host });
    // Two players remain, all Ready: a departure alone keeps a complete ready
    // check, so the countdown carries on.
    await t.mutation(api.players.leaveRoom, { sessionToken: third.sessionToken });
    expect((await setupOf(t, room.roomId))?.stage).toBe('countdown');

    // Falling below the game's minimum stops the countdown; a game that allows
    // one player keeps counting down.
    await t.mutation(api.players.leaveRoom, { sessionToken: room.guest });
    const minimum = gameLogicById('trivia')?.metadata.playerRange.min ?? 2;
    expect((await setupOf(t, room.roomId))?.stage).toBe(minimum > 1 ? 'ready' : 'countdown');
    if (minimum > 1) {
      await countdownEnds(t);
      expect(await runningOf(t, room.roomId)).toBeNull();
    }
  });

  it('can be skipped by the Host starting at once', async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const room = await party(t);
    await lockAndReady(t, room);
    await t.mutation(api.games.startCountdown, { sessionToken: room.host });

    await t.mutation(api.games.startGame, { sessionToken: room.host });
    expect(await runningOf(t, room.roomId)).toMatchObject({ kind: 'running' });
    // The cancelled start never fires into the running game.
    await countdownEnds(t);
    expect(await runningOf(t, room.roomId)).toMatchObject({ kind: 'running', gameId: 'trivia' });
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

describe('moving on from a Trivia reveal', () => {
  afterEach(() => vi.useRealTimers());

  async function phaseOf(t: Backend, roomId: Id<'rooms'>) {
    const running = await tvRunning(t, roomId);
    if (running?.kind !== 'running') throw new Error('expected a running game');
    const state = running.state as { phase: string; questionIndex: number };
    return { phase: state.phase, questionIndex: state.questionIndex };
  }

  async function revealed(t: Backend) {
    const room = await party(t);
    await lockAndReady(t, room);
    await t.mutation(api.games.startGame, { sessionToken: room.host });
    await vi.advanceTimersByTimeAsync(INTRO_SECONDS * 1000 + 1);
    await t.finishInProgressScheduledFunctions();
    for (const sessionToken of [room.host, room.guest]) {
      await t.mutation(api.games.sendEvent, {
        sessionToken,
        event: { kind: 'answer', questionIndex: 0, optionIndex: 0 },
      });
    }
    expect(await phaseOf(t, room.roomId)).toEqual({ phase: 'reveal', questionIndex: 0 });
    return room;
  }

  it('ignores a guest claiming to be the Host', async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const room = await revealed(t);

    await t.mutation(api.games.sendEvent, {
      sessionToken: room.guest,
      event: { kind: 'advance', questionIndex: 0, phase: 'reveal', fromHost: true },
    });

    expect(await phaseOf(t, room.roomId)).toEqual({ phase: 'reveal', questionIndex: 0 });
  });

  it('lets the Host move the room on before the break ends', async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const room = await revealed(t);

    await t.mutation(api.games.sendEvent, {
      sessionToken: room.host,
      event: { kind: 'advance', questionIndex: 0, phase: 'reveal' },
    });

    expect(await phaseOf(t, room.roomId)).toEqual({ phase: 'question', questionIndex: 1 });
  });
});
