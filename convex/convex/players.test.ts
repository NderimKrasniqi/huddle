import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { describe, expect, it } from 'vitest';

import { api } from './_generated/api';
import schema from './schema';
import type { Id } from './_generated/dataModel';
import type { JoinRejection } from './players';

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
      { playerId: joined.playerId, nickname: 'Ada' },
    ]);
  });
});
