import {
  AWAY_AFTER_MS,
  type ColorRejection,
  HEARTBEAT_INTERVAL_MS,
  type HostControlRejection,
  type JoinRejection,
  PLAYER_COLOR_NAMES,
} from '@huddle/game-core';
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

/**
 * Lets `ms` of the party go by, and runs whatever the room had scheduled for it.
 *
 * Only meaningful under fake timers — every suite below that uses it installs
 * them, because what these tests are about is seconds, and a suite that waited
 * for them would take minutes to say so.
 */
async function elapse(t: Backend, ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await t.finishInProgressScheduledFunctions();
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
      { playerId: joined.playerId, nickname: 'Ada', away: false, host: true },
    ]);
  });
});

/**
 * Color Claim: a player's server-validated pick of one of the ten swatches.
 *
 * The rule is the nickname rule in another dress — unique within a room, first
 * to ask wins — and it is enforced server-side for the same reason: the picker
 * dims what is taken as a courtesy to whoever is looking at it, not as a
 * promise about what arrives.
 */
describe('claimColor', () => {
  /** Ada's phone, tapping a swatch. */
  function claim(t: Backend, sessionToken: string, color: string): Promise<unknown> {
    return t.mutation(api.players.claimColor, { sessionToken, color });
  }

  /** Why a claim was refused, or `undefined` if it was not. */
  async function refusalOf(attempt: Promise<unknown>): Promise<ColorRejection | undefined> {
    try {
      await attempt;
      return undefined;
    } catch (error) {
      expect(error).toBeInstanceOf(ConvexError);
      return (error as ConvexError<ColorRejection>).data;
    }
  }

  /** The color the room is drawing this player in. */
  async function colorOf(
    t: Backend,
    roomId: Id<'rooms'>,
    nickname: string,
  ): Promise<string | undefined> {
    const roster = await t.query(api.players.roster, { roomId });
    return roster.find((seat) => seat.nickname === nickname)?.color;
  }

  it('records the color a player taps', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    const ada = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });

    await claim(t, ada.sessionToken, 'lagoon');

    expect(await colorOf(t, room.roomId, 'Ada')).toBe('lagoon');
  });

  it('seats a player with no color at all until they pick one', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    await join(t, room.code, 'Ada');

    // The picker is the screen they land on, so every seat has to be drawable
    // before anybody has claimed anything.
    expect(await colorOf(t, room.roomId, 'Ada')).toBeUndefined();
  });

  it('stores every color game-core says a player may claim', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);

    // The schema writes the ten names out; this is what holds that list to
    // game-core's, which is the one the picker and the server both read.
    for (const [index, color] of PLAYER_COLOR_NAMES.entries()) {
      const player = await t.mutation(api.players.joinRoom, {
        code: room.code,
        nickname: `Player ${index + 1}`,
      });
      expect(await refusalOf(claim(t, player.sessionToken, color))).toBeUndefined();
    }

    const roster = await t.query(api.players.roster, { roomId: room.roomId });
    expect(roster.map((seat) => seat.color)).toEqual([...PLAYER_COLOR_NAMES]);
  });

  it('refuses a color another player in the room is holding', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    const ada = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });
    const grace = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Grace' });

    await claim(t, ada.sessionToken, 'punch');

    expect(await refusalOf(claim(t, grace.sessionToken, 'punch'))).toEqual({
      kind: 'colorTaken',
      color: 'punch',
    });
    expect(await colorOf(t, room.roomId, 'Ada')).toBe('punch');
    expect(await colorOf(t, room.roomId, 'Grace')).toBeUndefined();
  });

  it('lets the same color be held in two different rooms', async () => {
    const t = convexTest(schema, modules);
    const first = await openRoom(t);
    const second = await openRoom(t);
    const ada = await t.mutation(api.players.joinRoom, { code: first.code, nickname: 'Ada' });
    const grace = await t.mutation(api.players.joinRoom, { code: second.code, nickname: 'Grace' });

    await claim(t, ada.sessionToken, 'sky');

    // Colors are unique within a room, like nicknames — two parties in one
    // house do not have to negotiate.
    expect(await refusalOf(claim(t, grace.sessionToken, 'sky'))).toBeUndefined();
  });

  it('moves a player who taps a second swatch, and frees the first', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    const ada = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });
    const grace = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Grace' });
    await claim(t, ada.sessionToken, 'yellow');

    await claim(t, ada.sessionToken, 'grape');

    // She holds one color, not two, and the one she left is somebody else's to
    // take.
    expect(await colorOf(t, room.roomId, 'Ada')).toBe('grape');
    expect(await refusalOf(claim(t, grace.sessionToken, 'yellow'))).toBeUndefined();
  });

  it('lets a player re-tap the color they already hold', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    const ada = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });
    await claim(t, ada.sessionToken, 'lime');

    // Their own color is not "taken" to them: a double tap confirms what the
    // screen already shows rather than refusing it.
    expect(await refusalOf(claim(t, ada.sessionToken, 'lime'))).toBeUndefined();
    expect(await colorOf(t, room.roomId, 'Ada')).toBe('lime');
  });

  it('refuses a color that is not one of the ten', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    const ada = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });

    // No picker sends this. `claimColor` is public and Huddle has no auth by
    // design, so the server does not get to assume one asked.
    expect(await refusalOf(claim(t, ada.sessionToken, 'chartreuse'))).toEqual({
      kind: 'colorUnknown',
      color: 'chartreuse',
    });
    expect(await colorOf(t, room.roomId, 'Ada')).toBeUndefined();
  });

  it('refuses a claim from a token no seat answers to', async () => {
    const t = convexTest(schema, modules);
    await openRoom(t);

    // Refused rather than ignored, unlike a heartbeat: a phone whose seat has
    // gone would otherwise be left showing a swatch it does not hold.
    expect(await refusalOf(claim(t, 'nobodysessiontoken000000', 'green'))).toEqual({
      kind: 'notInRoom',
    });
  });

  it('gives one of five players who claim the same color at once that color', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    const players = [];
    for (const name of ['Ada', 'Grace', 'Linus', 'Ken', 'Barbara']) {
      players.push(await t.mutation(api.players.joinRoom, { code: room.code, nickname: name }));
    }

    // Every claim is in flight before any of them commits, so each has to
    // decide from the database as it stands when it runs — see the note above
    // `joinRoom under simultaneous joins` for what this does and does not
    // exercise.
    const outcomes = await Promise.all(
      players.map((player) => refusalOf(claim(t, player.sessionToken, 'cobalt'))),
    );

    expect(outcomes.filter((outcome) => outcome === undefined)).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome?.kind === 'colorTaken')).toHaveLength(4);

    const roster = await t.query(api.players.roster, { roomId: room.roomId });
    expect(roster.filter((seat) => seat.color === 'cobalt')).toHaveLength(1);
  });

  it('leaves a room free of duplicate colors when every swatch is contested', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    const players = [];
    for (let seat = 1; seat <= 10; seat += 1) {
      players.push(
        await t.mutation(api.players.joinRoom, { code: room.code, nickname: `Player ${seat}` }),
      );
    }

    // Ten players and ten colors, each player working down the list from a
    // different place: every color is claimed by several phones at once, and
    // the room must still end with no two players sharing one.
    await Promise.all(
      players.flatMap((player, at) =>
        PLAYER_COLOR_NAMES.map((_unused, step) => {
          const color = PLAYER_COLOR_NAMES[(at + step) % PLAYER_COLOR_NAMES.length];
          if (color === undefined) {
            throw new Error('the palette is shorter than it says it is');
          }
          return refusalOf(claim(t, player.sessionToken, color));
        }),
      ),
    );

    const claimed = (await t.query(api.players.roster, { roomId: room.roomId }))
      .map((seat) => seat.color)
      .filter((color) => color !== undefined);
    expect(new Set(claimed).size).toBe(claimed.length);
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

/** Who the room is calling Host, by the name every client is told — or nobody. */
async function hostName(t: Backend, roomId: Id<'rooms'>): Promise<string | undefined> {
  const roster = await t.query(api.players.roster, { roomId });
  return roster.find((seat) => seat.host)?.nickname;
}

/**
 * How many players the room is calling Host at once.
 *
 * Asserted alongside *who* holds it, because the interesting failure of a
 * transfer is not landing on the wrong player — it is landing on a second one.
 */
async function hostCount(t: Backend, roomId: Id<'rooms'>): Promise<number> {
  const roster = await t.query(api.players.roster, { roomId });
  return roster.filter((seat) => seat.host).length;
}

/**
 * The Host, as a room hands it out: the first phone in the room gets it, and
 * nothing a later join does takes it away.
 */
describe('host', () => {
  it('gives the room to the first player who joins it', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);

    await join(t, room.code, 'Ada');

    expect(await hostName(t, room.roomId)).toBe('Ada');
  });

  it('leaves everyone who joins afterwards a regular player', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);

    await join(t, room.code, 'Ada');
    await join(t, room.code, 'Grace');
    await join(t, room.code, 'Linus');

    expect(await hostName(t, room.roomId)).toBe('Ada');
    expect(await hostCount(t, room.roomId)).toBe(1);
  });

  it('has no host to name in a room nobody has joined', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);

    // A television mints a room before there is anybody to run it. Nothing
    // renders a host here — but a room whose pointer had to be non-empty from
    // the start could only satisfy that by pointing at a player who does not
    // exist.
    expect(await hostName(t, room.roomId)).toBeUndefined();
  });

  it('gives each room its own host', async () => {
    const t = convexTest(schema, modules);
    const first = await openRoom(t);
    const second = await openRoom(t);

    await join(t, first.code, 'Ada');
    await join(t, second.code, 'Grace');

    expect(await hostName(t, first.roomId)).toBe('Ada');
    expect(await hostName(t, second.roomId)).toBe('Grace');
  });

  it('hands one host to a room a dozen phones join at once', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);

    // Every join is in flight before any of them commits, and each reads a room
    // whose host pointer the one before it may just have filled. Two hosts is
    // what a read made from anything other than the committed row produces —
    // see the note above `joinRoom under simultaneous joins`.
    const attempts = Array.from({ length: 12 }, (_unused, index) =>
      join(t, room.code, `Player ${index + 1}`),
    );
    await Promise.all(attempts.map(rejectionOf));

    expect(await hostCount(t, room.roomId)).toBe(1);
  });
});

/**
 * The Host leaving the party, which the room only ever learns the way it learns
 * anything about a phone: by not hearing from it. So a host who backgrounds
 * their phone, force-quits, or walks out of wifi range is one event, and the
 * room hands the room on at the moment it gives up on them — which is why this
 * rides on the same scheduled check that sets Away rather than on a clock of
 * its own.
 *
 * Fake timers, and the seconds asserted are the plan's own: within 15s of the
 * host going quiet, somebody else is running the room.
 */
describe('host transfer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** `ms` of party, with these phones doing what a foregrounded Controller does. */
  async function elapseBeating(
    t: Backend,
    sessionTokens: readonly string[],
    ms: number,
  ): Promise<void> {
    for (let gone = 0; gone < ms; gone += HEARTBEAT_INTERVAL_MS) {
      await elapse(t, Math.min(HEARTBEAT_INTERVAL_MS, ms - gone));
      for (const sessionToken of sessionTokens) {
        await t.mutation(api.players.heartbeat, { sessionToken });
      }
    }
  }

  /** Seats a player, and hands back what their phone would be holding. */
  function seatPlayer(t: Backend, code: string, nickname: string) {
    return t.mutation(api.players.joinRoom, { code, nickname });
  }

  it('hands the room to the longest-connected active player', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    await seatPlayer(t, room.code, 'Ada');
    const grace = await seatPlayer(t, room.code, 'Grace');
    const linus = await seatPlayer(t, room.code, 'Linus');

    // Ada's phone goes into a pocket; the other two are still in hands. Grace
    // joined first of the two, so the room is hers.
    await elapseBeating(t, [grace.sessionToken, linus.sessionToken], 15_000);

    expect(await hostName(t, room.roomId)).toBe('Grace');
    expect(await hostCount(t, room.roomId)).toBe(1);
  });

  it('moves the room inside the fifteen seconds a host may be gone for', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    await seatPlayer(t, room.code, 'Ada');
    const grace = await seatPlayer(t, room.code, 'Grace');

    // Ada's last word was her join, so this is the longest the room can take to
    // notice — and it may not act before ten seconds either, or a host who put
    // their phone down for a moment would lose the room.
    await elapseBeating(t, [grace.sessionToken], 10_000);
    expect(await hostName(t, room.roomId)).toBe('Ada');

    await elapseBeating(t, [grace.sessionToken], 5_000);
    expect(await hostName(t, room.roomId)).toBe('Grace');
  });

  it('passes over players who have gone quiet themselves', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    await seatPlayer(t, room.code, 'Ada');
    await seatPlayer(t, room.code, 'Grace');
    const linus = await seatPlayer(t, room.code, 'Linus');

    // The room empties out around the host: only Linus, who joined last, still
    // has a phone in his hand. Handing the room to Grace because she joined
    // before him would hand it to nobody.
    await elapseBeating(t, [linus.sessionToken], 15_000);

    expect(await hostName(t, room.roomId)).toBe('Linus');
    expect(await hostCount(t, room.roomId)).toBe(1);
  });

  it('leaves the room with an away host when nobody is there to take it', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    await seatPlayer(t, room.code, 'Ada');
    await seatPlayer(t, room.code, 'Grace');

    // Both phones are down. A room that dropped its host here would be a room
    // nobody can start a game in once they come back, so the host stays where
    // it is until somebody is actually able to hold it.
    await elapse(t, 15_000);

    expect(await hostName(t, room.roomId)).toBe('Ada');
  });

  it('gives an away host their room back the moment they beat, if nobody took it', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    const ada = await seatPlayer(t, room.code, 'Ada');
    await elapse(t, 15_000);

    await t.mutation(api.players.heartbeat, { sessionToken: ada.sessionToken });

    expect(await hostName(t, room.roomId)).toBe('Ada');
  });

  it('makes an original host who comes back a regular player', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    const ada = await seatPlayer(t, room.code, 'Ada');
    const grace = await seatPlayer(t, room.code, 'Grace');
    await elapseBeating(t, [grace.sessionToken], 15_000);
    expect(await hostName(t, room.roomId)).toBe('Grace');

    // Ada is back — with her seat, her nickname and her Session Token, and
    // without the room. Grace has been running it, and a host that snapped back
    // to whoever happened to join first would take it out of her hands mid-party.
    await t.mutation(api.players.heartbeat, { sessionToken: ada.sessionToken });

    expect(await hostName(t, room.roomId)).toBe('Grace');
    expect(await hostCount(t, room.roomId)).toBe(1);
  });

  it('leaves the host alone when a regular player goes quiet', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    const ada = await seatPlayer(t, room.code, 'Ada');
    await seatPlayer(t, room.code, 'Grace');

    await elapseBeating(t, [ada.sessionToken], 15_000);

    expect(await hostName(t, room.roomId)).toBe('Ada');
    expect(await hostCount(t, room.roomId)).toBe(1);
  });

  it('hands the room on again when the player who took it goes quiet too', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    await seatPlayer(t, room.code, 'Ada');
    const grace = await seatPlayer(t, room.code, 'Grace');
    const linus = await seatPlayer(t, room.code, 'Linus');

    // A party thinning out one phone at a time is the case this exists for: the
    // room has to keep finding somebody, not just survive the first departure.
    await elapseBeating(t, [grace.sessionToken, linus.sessionToken], 15_000);
    expect(await hostName(t, room.roomId)).toBe('Grace');

    await elapseBeating(t, [linus.sessionToken], 15_000);

    expect(await hostName(t, room.roomId)).toBe('Linus');
    expect(await hostCount(t, room.roomId)).toBe(1);
  });

  it('survives a host whose row has gone', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    const ada = await seatPlayer(t, room.code, 'Ada');
    const grace = await seatPlayer(t, room.code, 'Grace');

    // Room expiry deletes players out from under a pending check; the check
    // that would have moved the host still runs, and has to find nothing rather
    // than throw. It leaves the room pointing at a player who is gone, which is
    // only reachable by deleting a row on its own — expiry takes the room with
    // it, and the pointer dies there.
    await t.run(async (ctx) => {
      await ctx.db.delete(ada.playerId);
    });

    await expect(elapseBeating(t, [grace.sessionToken], 15_000)).resolves.toBeUndefined();
    expect(await rosterNames(t, room.roomId)).toEqual(['Grace']);
  });

  it('gives the room to the next player to join when the host it named is gone', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    const ada = await seatPlayer(t, room.code, 'Ada');
    await t.run(async (ctx) => {
      await ctx.db.delete(ada.playerId);
    });

    await seatPlayer(t, room.code, 'Grace');

    // The room would otherwise hold a pointer to nobody for good, and nothing a
    // later join did would clear it — a room no one present can ever start.
    expect(await hostName(t, room.roomId)).toBe('Grace');
    expect(await hostCount(t, room.roomId)).toBe(1);
  });

  it('leaves an original host who relaunches their app a regular player', async () => {
    const t = convexTest(schema, modules);
    const room = await openRoom(t);
    const ada = await seatPlayer(t, room.code, 'Ada');
    const grace = await seatPlayer(t, room.code, 'Grace');
    await elapseBeating(t, [grace.sessionToken], 15_000);

    // Not a foregrounded app this time but a force-quit one, coming back the
    // only way it can: its Session Token, and the seat that answers to it.
    // Rejoining is a read, and it must not be a way to take the room back.
    const rejoined = await t.query(api.players.session, { sessionToken: ada.sessionToken });
    await t.mutation(api.players.heartbeat, { sessionToken: ada.sessionToken });

    expect(rejoined).toMatchObject({ playerId: ada.playerId, nickname: 'Ada' });
    expect(await hostName(t, room.roomId)).toBe('Grace');
    expect(await hostCount(t, room.roomId)).toBe(1);
  });
});

/**
 * The Host's two direct controls over the roster: handing the room to another
 * player (`transferHost`) and removing one (`removePlayer`). Both name a seat by
 * the `playerId` the roster publishes to every client, and both are gated on the
 * Session Token holding the room's host — a public function trusts neither the
 * caller's claimed authority nor the id it sends.
 */
describe('host controls', () => {
  /** The refusal a refused host control carried, or `undefined` if it went through. */
  async function refusalOf(
    attempt: Promise<unknown>,
  ): Promise<HostControlRejection | undefined> {
    try {
      await attempt;
      return undefined;
    } catch (error) {
      expect(error).toBeInstanceOf(ConvexError);
      return (error as ConvexError<HostControlRejection>).data;
    }
  }

  describe('transferHost', () => {
    it('hands the room to the named player', async () => {
      const t = convexTest(schema, modules);
      const room = await openRoom(t);
      const ada = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });
      const grace = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Grace' });

      expect(await hostName(t, room.roomId)).toBe('Ada');

      await t.mutation(api.players.transferHost, {
        sessionToken: ada.sessionToken,
        playerId: grace.playerId,
      });

      // The pill moves to Grace, and there is still exactly one.
      expect(await hostName(t, room.roomId)).toBe('Grace');
      expect(await hostCount(t, room.roomId)).toBe(1);
    });

    it('refuses a phone that is not the Host', async () => {
      const t = convexTest(schema, modules);
      const room = await openRoom(t);
      await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });
      const grace = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Grace' });

      // A phone that does not run the room cannot hand it to anybody, itself
      // included — the whole of "manage the room" is the Host's.
      expect(
        await refusalOf(
          t.mutation(api.players.transferHost, {
            sessionToken: grace.sessionToken,
            playerId: grace.playerId,
          }),
        ),
      ).toEqual({ kind: 'notHost' });
      expect(await hostName(t, room.roomId)).toBe('Ada');
    });

    it('refuses a token no seat answers to', async () => {
      const t = convexTest(schema, modules);
      const room = await openRoom(t);
      const ada = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });

      expect(
        await refusalOf(
          t.mutation(api.players.transferHost, {
            sessionToken: 'a-token-no-seat-holds',
            playerId: ada.playerId,
          }),
        ),
      ).toEqual({ kind: 'notInRoom' });
    });

    it('refuses a target in another room', async () => {
      const t = convexTest(schema, modules);
      const room = await openRoom(t);
      const ada = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });
      const elsewhere = await openRoom(t);
      const outsider = await t.mutation(api.players.joinRoom, {
        code: elsewhere.code,
        nickname: 'Zoe',
      });

      // The id is real and names a real seat — just not one of this room's — so
      // the room the Host runs has no such player to hand itself to.
      expect(
        await refusalOf(
          t.mutation(api.players.transferHost, {
            sessionToken: ada.sessionToken,
            playerId: outsider.playerId,
          }),
        ),
      ).toEqual({ kind: 'targetNotInRoom' });
      expect(await hostName(t, room.roomId)).toBe('Ada');
    });

    it('refuses the Host handing the room to themselves', async () => {
      const t = convexTest(schema, modules);
      const room = await openRoom(t);
      const ada = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });

      expect(
        await refusalOf(
          t.mutation(api.players.transferHost, {
            sessionToken: ada.sessionToken,
            playerId: ada.playerId,
          }),
        ),
      ).toEqual({ kind: 'targetIsSelf' });
      expect(await hostName(t, room.roomId)).toBe('Ada');
    });

    it('refuses handing the room to a phone it has stopped hearing from', async () => {
      const t = convexTest(schema, modules);
      const room = await openRoom(t);
      const ada = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });
      const grace = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Grace' });

      // Grace's phone last spoke long enough ago that the room counts her gone —
      // the same `lastSeenAt` reading the automatic handover uses to pick a
      // successor. A room a game runs in must have a host who can run it.
      await t.run(async (ctx) => {
        await ctx.db.patch(grace.playerId, { lastSeenAt: Date.now() - AWAY_AFTER_MS - 1 });
      });

      expect(
        await refusalOf(
          t.mutation(api.players.transferHost, {
            sessionToken: ada.sessionToken,
            playerId: grace.playerId,
          }),
        ),
      ).toEqual({ kind: 'targetAway' });
      expect(await hostName(t, room.roomId)).toBe('Ada');
    });
  });

  describe('removePlayer', () => {
    it('deletes the seat and invalidates its token', async () => {
      const t = convexTest(schema, modules);
      const room = await openRoom(t);
      const ada = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });
      const grace = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Grace' });

      await t.mutation(api.players.removePlayer, {
        sessionToken: ada.sessionToken,
        playerId: grace.playerId,
      });

      // Off the roster, and her token now answers to no seat — which is the
      // whole of being removed: her phone falls back to the Join Screen.
      expect(await rosterNames(t, room.roomId)).toEqual(['Ada']);
      expect(await t.query(api.players.session, { sessionToken: grace.sessionToken })).toBeNull();
      // The Host is untouched: removal never unseats the room's host.
      expect(await hostName(t, room.roomId)).toBe('Ada');
    });

    it('lets a removed person rejoin as a fresh seat', async () => {
      const t = convexTest(schema, modules);
      const room = await openRoom(t);
      const ada = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });
      const grace = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Grace' });

      await t.mutation(api.players.removePlayer, {
        sessionToken: ada.sessionToken,
        playerId: grace.playerId,
      });

      // The name is free again, so the same person can come back — as a new
      // participant with a new token, not the seat that was taken from them.
      // There is no ban list; a new join is a new seat.
      const rejoined = await t.mutation(api.players.joinRoom, {
        code: room.code,
        nickname: 'Grace',
      });

      expect(rejoined.sessionToken).not.toBe(grace.sessionToken);
      expect(rejoined.playerId).not.toBe(grace.playerId);
      expect(await t.query(api.players.session, { sessionToken: grace.sessionToken })).toBeNull();
      expect(
        await t.query(api.players.session, { sessionToken: rejoined.sessionToken }),
      ).not.toBeNull();
      expect(await rosterNames(t, room.roomId)).toEqual(['Ada', 'Grace']);
    });

    it('refuses a phone that is not the Host', async () => {
      const t = convexTest(schema, modules);
      const room = await openRoom(t);
      const ada = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });
      const grace = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Grace' });

      // A player cannot remove the Host, or anybody else: removal is a host
      // power, not a vote.
      expect(
        await refusalOf(
          t.mutation(api.players.removePlayer, {
            sessionToken: grace.sessionToken,
            playerId: ada.playerId,
          }),
        ),
      ).toEqual({ kind: 'notHost' });
      expect(await rosterNames(t, room.roomId)).toEqual(['Ada', 'Grace']);
    });

    it('refuses a token no seat answers to', async () => {
      const t = convexTest(schema, modules);
      const room = await openRoom(t);
      const ada = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });

      expect(
        await refusalOf(
          t.mutation(api.players.removePlayer, {
            sessionToken: 'a-token-no-seat-holds',
            playerId: ada.playerId,
          }),
        ),
      ).toEqual({ kind: 'notInRoom' });
    });

    it('refuses a target in another room', async () => {
      const t = convexTest(schema, modules);
      const room = await openRoom(t);
      const ada = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });
      const elsewhere = await openRoom(t);
      const outsider = await t.mutation(api.players.joinRoom, {
        code: elsewhere.code,
        nickname: 'Zoe',
      });

      expect(
        await refusalOf(
          t.mutation(api.players.removePlayer, {
            sessionToken: ada.sessionToken,
            playerId: outsider.playerId,
          }),
        ),
      ).toEqual({ kind: 'targetNotInRoom' });
      // The outsider is untouched in their own room.
      expect(await rosterNames(t, elsewhere.roomId)).toEqual(['Zoe']);
    });

    it('refuses the Host removing themselves', async () => {
      const t = convexTest(schema, modules);
      const room = await openRoom(t);
      const ada = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });

      // A host leaves by ending the room, not by removing their own seat — which
      // would drop the room's host and leave nobody named to run it.
      expect(
        await refusalOf(
          t.mutation(api.players.removePlayer, {
            sessionToken: ada.sessionToken,
            playerId: ada.playerId,
          }),
        ),
      ).toEqual({ kind: 'targetIsSelf' });
      expect(await rosterNames(t, room.roomId)).toEqual(['Ada']);
    });

    it('removes a player mid-game, and the room stays in its game', async () => {
      const t = convexTest(schema, modules);
      const room = await openRoom(t);
      const ada = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada' });
      const grace = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Grace' });
      await t.mutation(api.games.startGame, { sessionToken: ada.sessionToken, gameId: 'trivia' });

      // A phone that went quiet mid-game and will not be back. Removing it is
      // allowed while a game runs; the room keeps playing (now below trivia's
      // minimum, which is the Host's to end or wait out — the beat the removed
      // seat is holding up still resolves on the room's own clock).
      await t.mutation(api.players.removePlayer, {
        sessionToken: ada.sessionToken,
        playerId: grace.playerId,
      });

      expect(await t.query(api.games.running, { roomId: room.roomId })).not.toBeNull();
      expect(await rosterNames(t, room.roomId)).toEqual(['Ada']);
    });
  });
});
