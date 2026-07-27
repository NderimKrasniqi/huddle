import { HEARTBEAT_INTERVAL_MS, type JoinRejection } from '@huddle/game-core';
import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from './_generated/api';
import schema from './schema';
import type { Id } from './_generated/dataModel';

// See schema.test.ts: pnpm's isolated node_modules layout defeats convex-test's
// default module lookup, so the function modules are handed over explicitly.
const modules = import.meta.glob(['./**/*.*s', '!./**/*.d.ts', '!./**/*.test.*']);

type Backend = ReturnType<typeof convexTest>;

/** A room to join, opened the way the TV opens one. */
async function openRoom(t: Backend) {
  return await t.mutation(api.rooms.createRoom, {});
}

function join(t: Backend, code: string, nickname: string): Promise<unknown> {
  return t.mutation(api.players.joinRoom, { code, nickname });
}

/**
 * Why a join was refused, or `undefined` if it was not.
 *
 * The `data` is what is asserted rather than the message, for the reason the
 * rejections carry data at all: the Controller picks its copy by `kind`, so a
 * rejection that only reads right in English is a rejection it cannot render.
 */
async function rejectionOf(attempt: Promise<unknown>): Promise<JoinRejection | undefined> {
  try {
    await attempt;
    return undefined;
  } catch (error) {
    expect(error).toBeInstanceOf(ConvexError);
    return (error as ConvexError<JoinRejection>).data;
  }
}

/** The nicknames the TV would draw on its seats, in seat order. */
async function rosterNames(t: Backend, roomId: Id<'rooms'>): Promise<string[]> {
  const roster = await t.query(api.players.roster, { roomId });
  return roster.map((seat) => seat.nickname);
}

describe('joinRoom', () => {
  it('seats a player in the room holding the code, under their nickname', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);

    const joined = await t.mutation(api.players.joinRoom, {
      code: room.code,
      nickname: 'Nderim',
    });

    expect(joined.roomId).toBe(room.roomId);
    expect(await rosterNames(t, room.roomId)).toEqual(['Nderim']);
    await t.run(async (ctx) => {
      expect(await ctx.db.get(joined.playerId)).toMatchObject({
        roomId: room.roomId,
        nickname: 'Nderim',
      });
    });
  });

  it('puts players on the roster in join order', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);

    await join(t, room.code, 'Ada');
    await join(t, room.code, 'Grace');
    await join(t, room.code, 'Linus');

    expect(await rosterNames(t, room.roomId)).toEqual(['Ada', 'Grace', 'Linus']);
  });

  it('keeps players out of every room but the one whose code they typed', async () => {
    const t = convexTest(schema, modules);
    const first = await openRoom(t);
    const second = await openRoom(t);

    await join(t, first.code, 'Ada');

    expect(await rosterNames(t, second.roomId)).toEqual([]);
  });

  it('takes the code as it is typed — spaced or lower-case', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);

    await join(t, ` ${room.code.toLowerCase()} `, 'Ada');

    expect(await rosterNames(t, room.roomId)).toEqual(['Ada']);
  });

  it('rejects a code no room holds with "room not found"', async () => {
    const t = convexTest(schema, modules);
    await openRoom(t);

    expect(await rejectionOf(join(t, 'ZZZZ', 'Ada'))).toEqual({
      kind: 'roomNotFound',
      code: 'ZZZZ',
    });
  });

  it('rejects a nickname already in the room with "name taken"', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    await join(t, room.code, 'Ada');

    expect(await rejectionOf(join(t, room.code, 'Ada'))).toEqual({
      kind: 'nameTaken',
      nickname: 'Ada',
    });
    expect(await rosterNames(t, room.roomId)).toEqual(['Ada']);
  });

  it('treats a nickname differing only in case or spacing as the same name', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    await join(t, room.code, 'Ada');

    // Two seats reading "Ada" and "ada" are one name to everyone looking at
    // the TV, whatever the database thinks.
    expect(await rejectionOf(join(t, room.code, '  ADA '))).toMatchObject({
      kind: 'nameTaken',
    });
  });

  it('lets the same nickname sit in two different rooms', async () => {
    const t = convexTest(schema, modules);
    const first = await openRoom(t);
    const second = await openRoom(t);

    await join(t, first.code, 'Ada');

    expect(await rejectionOf(join(t, second.code, 'Ada'))).toBeUndefined();
  });

  it('rejects a nickname of nothing — the trim comes first', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);

    // Empty, and spaces-only: the second is the first once the nickname has
    // been trimmed, and a seat nobody can read a name off is not a seat.
    expect(await rejectionOf(join(t, room.code, ''))).toEqual({
      kind: 'nameUnusable',
      maxLength: 20,
    });
    expect(await rejectionOf(join(t, room.code, '   '))).toMatchObject({
      kind: 'nameUnusable',
    });
    expect(await rosterNames(t, room.roomId)).toEqual([]);
  });

  it('rejects a nickname longer than a room will hold', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);

    // Twenty, spelled out for the reason the cap is: it is a decision, not
    // whatever the constant happens to say today.
    expect(await rejectionOf(join(t, room.code, 'N'.repeat(20)))).toBeUndefined();
    expect(await rejectionOf(join(t, room.code, 'M'.repeat(21)))).toMatchObject({
      kind: 'nameUnusable',
      maxLength: 20,
    });
    // The length no client is stopping: a name is not a payload.
    expect(await rejectionOf(join(t, room.code, 'M'.repeat(200_000)))).toMatchObject({
      kind: 'nameUnusable',
    });
    expect(await rosterNames(t, room.roomId)).toEqual(['N'.repeat(20)]);
  });

  it('measures a nickname in characters, not in UTF-16 units', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);

    // Twenty dice are forty UTF-16 units and twenty characters — a name of
    // twenty things to whoever typed it.
    expect(await rejectionOf(join(t, room.code, '🎲'.repeat(20)))).toBeUndefined();
    expect(await rejectionOf(join(t, room.code, '🎲'.repeat(21)))).toMatchObject({
      kind: 'nameUnusable',
    });
  });

  it('rejects the eleventh player with "room full"', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    // Ten, spelled out rather than read from ROOM_PLAYER_CAP: the cap is a
    // pinned product decision, so a test that follows the constant wherever it
    // moves would stop testing anything.
    for (let seat = 1; seat <= 10; seat += 1) {
      expect(await rejectionOf(join(t, room.code, `Player ${seat}`))).toBeUndefined();
    }

    expect(await rejectionOf(join(t, room.code, 'Player 11'))).toEqual({
      kind: 'roomFull',
      cap: 10,
    });
    expect(await rosterNames(t, room.roomId)).toHaveLength(10);
  });

  it('refuses a full room before it complains about the name', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    for (let seat = 1; seat <= 10; seat += 1) {
      await join(t, room.code, `Player ${seat}`);
    }

    // Both rules apply; "name taken" would send them back to type another name
    // into a room that has no seat for any name.
    expect(await rejectionOf(join(t, room.code, 'Player 1'))).toMatchObject({
      kind: 'roomFull',
    });
  });
});

/**
 * The rules above are read-then-write, so the only interesting question is what
 * they do when joins arrive together — twelve phones tapping Join on the same
 * countdown, or a table of friends all typing "Sam".
 *
 * convex-test runs one top-level mutation at a time on purpose (its
 * `TransactionManager`: "We force sequential execution"), so what these tests
 * exercise is concurrent *dispatch*: every join is in flight before any of them
 * commits, and each one must decide from the database as it stands when it
 * runs. That catches a check made from anything the caller computed up front,
 * and it pins the outcome the room must produce. What it cannot exercise is two
 * transactions committing in parallel — against that, the guarantee is Convex's
 * serializable OCC and the read set `joinRoom` deliberately builds (see
 * players.ts), the same property `createRoom` leans on for code uniqueness.
 */
describe('joinRoom under simultaneous joins', () => {
  it('seats ten of twelve players who all join at once', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);

    const attempts = Array.from({ length: 12 }, (_unused, index) =>
      join(t, room.code, `Player ${index + 1}`),
    );
    const outcomes = await Promise.all(attempts.map(rejectionOf));

    expect(outcomes.filter((outcome) => outcome === undefined)).toHaveLength(10);
    expect(outcomes.filter((outcome) => outcome?.kind === 'roomFull')).toHaveLength(2);
    expect(await rosterNames(t, room.roomId)).toHaveLength(10);
  });

  it('seats one of five players who all claim the same nickname at once', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);

    const attempts = Array.from({ length: 5 }, () => join(t, room.code, 'Sam'));
    const outcomes = await Promise.all(attempts.map(rejectionOf));

    expect(outcomes.filter((outcome) => outcome === undefined)).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome?.kind === 'nameTaken')).toHaveLength(4);
    expect(await rosterNames(t, room.roomId)).toEqual(['Sam']);
  });

  it('leaves the roster free of duplicates when a full room is stormed', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);

    // Twenty-four joins over twelve nicknames, each claimed twice in a row:
    // both rules are contested at once, and every duplicate arrives while its
    // twin is still in flight. Ten distinct names on the roster is only
    // possible if neither rule lost its race.
    const attempts = Array.from({ length: 24 }, (_unused, index) =>
      join(t, room.code, `Player ${Math.floor(index / 2) + 1}`),
    );
    await Promise.all(attempts.map(rejectionOf));

    const names = await rosterNames(t, room.roomId);
    expect(names).toHaveLength(10);
    expect(new Set(names).size).toBe(10);
  });
});

/**
 * Rejoining: the phone that force-quit and came back. Nothing here creates a
 * player — the seat was never given up, so returning to it is a read of the
 * Session Token the phone kept, which is exactly why the roster cannot grow a
 * duplicate no matter how often an app is killed.
 */
describe('session', () => {
  /** The seat a token still holds, the way a relaunched Controller asks for it. */
  function sessionOf(t: Backend, sessionToken: string) {
    return t.query(api.players.session, { sessionToken });
  }

  it('gives a joining phone a Session Token, and a different one to every player', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);

    const ada = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });
    const grace = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Grace' });

    expect(ada.sessionToken).toMatch(/^[a-z0-9]{24}$/);
    expect(grace.sessionToken).not.toBe(ada.sessionToken);
  });

  it('puts a returning phone back on the same player row, under the same nickname', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    const joined = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });

    // The app was force-quit here: everything the Controller held is gone but
    // the token it wrote to the phone.
    const resumed = await sessionOf(t, joined.sessionToken);

    expect(resumed).toEqual({
      playerId: joined.playerId,
      roomId: room.roomId,
      code: room.code,
      nickname: 'Ada',
    });
  });

  it('leaves the roster exactly as it was — a rejoin is not a second player', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    const joined = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });

    // Ada's phone dies and comes back, the party carries on around her, and it
    // dies again: the same seat both times, and a roster that grew only by the
    // player who actually joined.
    expect(await sessionOf(t, joined.sessionToken)).toMatchObject({ playerId: joined.playerId });

    await join(t, room.code, 'Grace');

    expect(await sessionOf(t, joined.sessionToken)).toMatchObject({
      playerId: joined.playerId,
      nickname: 'Ada',
    });
    expect(await rosterNames(t, room.roomId)).toEqual(['Ada', 'Grace']);
  });

  it('knows nothing about a token no player holds', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    await join(t, room.code, 'Ada');

    // A phone carrying a token from a room that no longer exists, or a token
    // from nowhere at all: both are somebody who has not joined this room.
    expect(await sessionOf(t, 'nobodysessiontoken000000')).toBeNull();
  });

  it('is over once the room is gone, even if the player row outlives it', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    const joined = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });

    // Room expiry (Phase 2) deletes both, but the order is its business: a
    // session that named a room the client cannot find is a seat in nothing.
    await t.run(async (ctx) => {
      await ctx.db.delete(room.roomId);
    });

    expect(await sessionOf(t, joined.sessionToken)).toBeNull();
  });

  it('keeps the Session Token off the roster the whole room can see', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    const joined = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });

    // The token is on the row — and the TV, which draws its seats on a screen
    // everybody in the room is looking at, is not told it.
    await t.run(async (ctx) => {
      expect(await ctx.db.get(joined.playerId)).toMatchObject({
        sessionToken: joined.sessionToken,
      });
    });
    const roster = await t.query(api.players.roster, { roomId: room.roomId });
    expect(JSON.stringify(roster)).not.toContain(joined.sessionToken);
  });
});

describe('roster', () => {
  it('is empty for a room nobody has joined', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);

    expect(await t.query(api.players.roster, { roomId: room.roomId })).toEqual([]);
  });

  it('gives the TV a seat id and a nickname, and nothing else about a player', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    const joined = await t.mutation(api.players.joinRoom, {
      code: room.code,
      nickname: 'Ada',
    });

    // The TV is a renderer: it gets what it draws. Player rows grow private
    // fields in Phase 2 (the Session Token), and this projection is what keeps
    // them off a screen the whole room is looking at.
    expect(await t.query(api.players.roster, { roomId: room.roomId })).toEqual([
      { playerId: joined.playerId, nickname: 'Ada', away: false },
    ]);
  });
});

/**
 * Presence: the phone that is still in somebody's hand, and the one that went
 * into a pocket. The room hears a heartbeat every few seconds from every phone
 * that is awake, and a scheduled check turns a player Away when it stops.
 *
 * The clock is the subject here, so these run on fake timers: the promise is
 * about seconds, and a suite that waited for them would take minutes to say so.
 * The seconds asserted below are the scope's own — backgrounded ≥10s, away
 * within a further 5 — rather than the constants the implementation uses, which
 * `packages/game-core/src/presence.test.ts` pins to those same sentences.
 */
describe('presence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Lets `ms` of the party go by, and runs whatever the room had scheduled for it. */
  async function elapse(t: Backend, ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    await t.finishInProgressScheduledFunctions();
  }

  /** Whether the TV's roster is drawing this player as away. */
  async function isAway(t: Backend, roomId: Id<'rooms'>, nickname: string): Promise<boolean> {
    const roster = await t.query(api.players.roster, { roomId });
    const seat = roster.find((player) => player.nickname === nickname);

    if (seat === undefined) {
      throw new Error(`${nickname} is not on the roster`);
    }

    return seat.away;
  }

  /** A room with Ada in it, holding the token her phone would beat with. */
  async function roomWithAda(t: Backend) {
    const room = await openRoom(t);
    const ada = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });
    return { ...room, playerId: ada.playerId, sessionToken: ada.sessionToken };
  }

  /** Away-checks the room still has scheduled against this player. */
  async function pendingAwayChecks(t: Backend, playerId: Id<'players'>): Promise<number> {
    return await t.run(async (ctx) => {
      const scheduled = await ctx.db.system.query('_scheduled_functions').collect();

      return scheduled.filter((job) => {
        const [args] = job.args as [{ readonly playerId?: Id<'players'> }];
        return job.state.kind === 'pending' && args.playerId === playerId;
      }).length;
    });
  }

  it('seats a joining player as present', async () => {
    const t = convexTest(schema, modules);
    const { roomId } = await roomWithAda(t);

    expect(await isAway(t, roomId, 'Ada')).toBe(false);
  });

  it('marks a backgrounded phone away — after ten seconds, and inside a further five', async () => {
    const t = convexTest(schema, modules);
    const { roomId } = await roomWithAda(t);

    // Ada's phone goes into her pocket the instant she joins: the beats stop,
    // and nothing else about her changes. This is the longest the room can take
    // to notice, because her last beat is as recent as it can be.
    await elapse(t, 10_000);
    expect(await isAway(t, roomId, 'Ada')).toBe(false);

    await elapse(t, 5_000);
    expect(await isAway(t, roomId, 'Ada')).toBe(true);
  });

  it('leaves a phone that keeps beating alone, however long the lobby sits', async () => {
    const t = convexTest(schema, modules);
    const { roomId, sessionToken } = await roomWithAda(t);

    // Half a minute of a Controller doing exactly what it does, which is more
    // than one away-check's worth: the check has to find her fresh and go back
    // to waiting, every time.
    for (let beat = 0; beat < 10; beat += 1) {
      await elapse(t, HEARTBEAT_INTERVAL_MS);
      await t.mutation(api.players.heartbeat, { sessionToken });
      expect(await isAway(t, roomId, 'Ada')).toBe(false);
    }
  });

  it('notices a phone that goes quiet mid-lobby, not only one that never spoke', async () => {
    const t = convexTest(schema, modules);
    const { roomId, sessionToken } = await roomWithAda(t);

    // A beat lands, and is the last one: the check already pending was armed
    // against her join, so it comes due while she is still fresh and has to go
    // back to waiting rather than call it a day.
    await elapse(t, HEARTBEAT_INTERVAL_MS);
    await t.mutation(api.players.heartbeat, { sessionToken });

    await elapse(t, 10_000);
    expect(await isAway(t, roomId, 'Ada')).toBe(false);
    await elapse(t, 5_000);
    expect(await isAway(t, roomId, 'Ada')).toBe(true);
  });

  it('watches a beating phone with one check, not one per beat', async () => {
    const t = convexTest(schema, modules);
    const { playerId, sessionToken } = await roomWithAda(t);
    expect(await pendingAwayChecks(t, playerId)).toBe(1);

    for (let beat = 0; beat < 5; beat += 1) {
      await elapse(t, HEARTBEAT_INTERVAL_MS);
      await t.mutation(api.players.heartbeat, { sessionToken });
    }

    // Arming a fresh check on every beat would work, and would pile up one
    // scheduled function per phone per three seconds for as long as the party
    // lasted, with every other test in this file still passing. Away-ness is
    // the same thing as having no check pending, and that only holds if the
    // count does.
    expect(await pendingAwayChecks(t, playerId)).toBe(1);

    // And a phone that went quiet, was noticed, and came back is watched by
    // exactly one again — not none, and not the one it left plus the one its
    // return started.
    await elapse(t, 15_000);
    expect(await pendingAwayChecks(t, playerId)).toBe(0);
    await t.mutation(api.players.heartbeat, { sessionToken });
    expect(await pendingAwayChecks(t, playerId)).toBe(1);
  });

  it('brings a player back the moment their phone beats again', async () => {
    const t = convexTest(schema, modules);
    const { roomId, sessionToken } = await roomWithAda(t);
    await elapse(t, 15_000);
    expect(await isAway(t, roomId, 'Ada')).toBe(true);

    // Foregrounding sends a beat straight away, and clearing the badge costs
    // one round trip rather than any part of the five seconds it is allowed.
    await t.mutation(api.players.heartbeat, { sessionToken });

    expect(await isAway(t, roomId, 'Ada')).toBe(false);
  });

  it('goes on watching a phone that came back, so a second disappearance shows too', async () => {
    const t = convexTest(schema, modules);
    const { roomId, sessionToken } = await roomWithAda(t);
    await elapse(t, 15_000);
    await t.mutation(api.players.heartbeat, { sessionToken });
    expect(await isAway(t, roomId, 'Ada')).toBe(false);

    // Ada put the phone down again. Nothing about the second time is different,
    // and a room that only ever noticed the first would be worse than useless
    // at the end of a party.
    await elapse(t, 10_000);
    expect(await isAway(t, roomId, 'Ada')).toBe(false);
    await elapse(t, 5_000);
    expect(await isAway(t, roomId, 'Ada')).toBe(true);
  });

  it('keeps one player going quiet off everybody else', async () => {
    const t = convexTest(schema, modules);
    const { roomId, code, sessionToken } = await roomWithAda(t);
    await join(t, code, 'Grace');

    await elapse(t, 15_000);
    expect(await isAway(t, roomId, 'Ada')).toBe(true);
    expect(await isAway(t, roomId, 'Grace')).toBe(true);

    await t.mutation(api.players.heartbeat, { sessionToken });

    expect(await isAway(t, roomId, 'Ada')).toBe(false);
    expect(await isAway(t, roomId, 'Grace')).toBe(true);
  });

  it('ignores a beat from a token no seat answers to', async () => {
    const t = convexTest(schema, modules);
    const { roomId } = await roomWithAda(t);

    // A phone whose room has expired under it, or one carrying a token from
    // nowhere: there is nothing to hold present and nothing to complain about.
    await t.mutation(api.players.heartbeat, { sessionToken: 'nobodysessiontoken000000' });

    expect(await isAway(t, roomId, 'Ada')).toBe(false);
  });

  it('stops watching a player whose row has gone', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    const ada = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });

    // Room expiry deletes players out from under a pending check. The check
    // still runs, and has to find nothing rather than throw.
    await t.run(async (ctx) => {
      await ctx.db.delete(ada.playerId);
    });

    await expect(elapse(t, 15_000)).resolves.toBeUndefined();
    expect(await t.query(api.players.roster, { roomId: room.roomId })).toEqual([]);
  });
});
