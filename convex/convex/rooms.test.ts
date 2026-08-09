import {
  AVATAR_IDS,
  HEARTBEAT_INTERVAL_MS,
  ROOM_CODE_LENGTH,
  ROOM_CODE_MINT_ALPHABET,
  UNJOINED_ROOM_EXPIRY_MS,
} from '@huddle/game-core';
import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';
import type { RoomCodeExhausted } from './rooms';

// See schema.test.ts: pnpm's isolated node_modules layout defeats convex-test's
// default module lookup, so the function modules are handed over explicitly.
const modules = import.meta.glob(['./**/*.*s', '!./**/*.d.ts', '!./**/*.test.*']);

type Backend = ReturnType<typeof convexTest>;

/**
 * The `Math.random()` draw that lands on a given letter, aimed at the middle of
 * the letter's slice of [0, 1) so no rounding can push it into a neighbour.
 *
 * A letter the alphabet does not hold is a test pinning a code `createRoom`
 * could never mint, so it fails here rather than pinning a different code than
 * the one it names.
 */
function drawFor(letter: string): number {
  const index = ROOM_CODE_MINT_ALPHABET.indexOf(letter);
  if (index < 0) {
    throw new Error(`No draw lands on "${letter}": ROOM_CODE_MINT_ALPHABET does not hold it`);
  }
  return (index + 0.5) / ROOM_CODE_MINT_ALPHABET.length;
}

/**
 * Pins `Math.random()` so that `createRoom` draws exactly these codes, in this
 * order — the only way a uniqueness test proves anything: two real random draws
 * differ by luck, not by design.
 */
function pinDrawsTo(...codes: readonly string[]): void {
  const values = codes.flatMap((code) => [...code].map(drawFor));
  let next = 0;

  vi.spyOn(Math, 'random').mockImplementation(() => {
    const value = values[next];
    if (value === undefined) {
      throw new Error(`createRoom drew past the pinned codes [${codes.join(', ')}]`);
    }
    next += 1;
    return value;
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createRoom', () => {
  it('can mint a Room Code holding I after the tvOS tile fix', async () => {
    const t = convexTest(schema, modules);
    pinDrawsTo('RIJI');

    const room = await t.mutation(api.rooms.createRoom, {});

    expect(room.code).toBe('RIJI');
    // `convex-test` uses Math.random for its snapshot runner too; the pin is
    // only for the Room Code draw, so release it before inspecting the row.
    vi.restoreAllMocks();
    await t.run(async (ctx) => {
      expect(await ctx.db.get(room.roomId)).toMatchObject({ code: 'RIJI' });
    });
  });

  it('returns a room whose Room Code is minted from the minting alphabet', async () => {
    const t = convexTest(schema, modules);

    const room = await t.mutation(api.rooms.createRoom, {});

    // Driven off the product alphabet rather than /^[A-Z]{4}$/, so this test
    // stays coupled to the Room Code decision, including the restored I.
    expect(room.code).toHaveLength(ROOM_CODE_LENGTH);
    expect([...room.code].every((letter) => ROOM_CODE_MINT_ALPHABET.includes(letter))).toBe(true);
    await t.run(async (ctx) => {
      expect(await ctx.db.get(room.roomId)).toMatchObject({ code: room.code });
    });
  });

  it('gives two rooms different codes', async () => {
    const t = convexTest(schema, modules);

    const first = await t.mutation(api.rooms.createRoom, {});
    const second = await t.mutation(api.rooms.createRoom, {});

    expect(second.code).not.toBe(first.code);
  });

  it('redraws when the drawn code is already held by a live room', async () => {
    const t = convexTest(schema, modules);
    // The second room draws KWRD again — the code its predecessor holds — and
    // must not settle for it.
    pinDrawsTo('KWRD', 'KWRD', 'ZEBU');

    const first = await t.mutation(api.rooms.createRoom, {});
    const second = await t.mutation(api.rooms.createRoom, {});

    expect(first.code).toBe('KWRD');
    expect(second.code).toBe('ZEBU');
  });

  it('fails rather than hand out a code a live room already holds', async () => {
    const t = convexTest(schema, modules);
    // Every draw collides with the first room's code. More codes are pinned
    // than `createRoom` may ever draw, so the run also proves the redraw loop
    // is bounded: an unbounded one exhausts the pin and fails on that instead.
    pinDrawsTo(...Array<string>(100).fill('KWRD'));

    await t.mutation(api.rooms.createRoom, {});
    const rejection: unknown = await t
      .mutation(api.rooms.createRoom, {})
      .then(() => undefined)
      .catch((error: unknown) => error);

    // Asserting the structured `data` rather than the message keeps the
    // bounded-throw/unbounded-spin distinction: an unbounded loop draws past
    // the pinned codes and rejects with the pin's plain Error, which carries no
    // `roomCodeExhausted` data and fails here.
    expect(rejection).toBeInstanceOf(ConvexError);
    expect((rejection as ConvexError<RoomCodeExhausted>).data).toEqual({
      kind: 'roomCodeExhausted',
      draws: expect.any(Number),
    });
  });
});

/**
 * Room expiry: the room outliving the party by the ten minutes the plan allows,
 * and then taking its players with it.
 *
 * "The last player disconnects" is a thing the room can only ever infer, and it
 * infers it the one way it infers anything about a phone — by not being heard
 * from. So a *deserted* room is one whose every player has gone Away, and the
 * ten minutes run from the last heartbeat the room heard from anybody. That
 * makes rejoining, backgrounding, force-quitting and a dropped router one event
 * here, exactly as they are for presence.
 *
 * Fake timers, because the subject is minutes: the suite says so in
 * milliseconds rather than waiting for them.
 */
describe('room expiry', () => {
  const TEN_MINUTES = 10 * 60 * 1_000;

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Lets `ms` of the evening go by, running whatever the room had scheduled for
   * it. The twin of the helper in players.test.ts — the two suites both live on
   * the room's clock, and neither imports the other's fixtures.
   */
  async function elapse(t: Backend, ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    await t.finishInProgressScheduledFunctions();
  }

  /** `ms` of evening with these phones doing what a foregrounded Controller does. */
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

  /** A distinct avatar per nickname — one avatar per room is a join rule now. */
  function avatarFor(nickname: string): string {
    const seat = /^Player (\d+)$/u.exec(nickname)?.[1];

    if (seat !== undefined) {
      return AVATAR_IDS[(Number(seat) - 1) % AVATAR_IDS.length]!;
    }

    // A table, not a hash: two nicknames of the same length would collide, and
    // a collision here fails a test about room expiry with a message about
    // avatars.
    const named: Readonly<Record<string, string>> = {
      Ada: 'fox',
      Grace: 'green-alien',
      Linus: 'pink-bunny',
      Nderim: 'blue-robot',
    };

    return named[nickname] ?? 'teal-bear';
  }

  /** Seats a player, and hands back what their phone would be holding. */
  function seatPlayer(t: Backend, code: string, nickname: string, avatar?: string) {
    return t.mutation(api.players.joinRoom, {
      code,
      nickname,
      // Distinct per nickname, because within a room nicknames already are —
      // and one avatar per room is now a rule the join enforces.
      avatar: avatar ?? avatarFor(nickname),
    });
  }

  /**
   * How many player rows the room still holds. Asked through the roster, which
   * reads the players by room and not through the room — so a room deleted
   * without its players would still answer with them, which is exactly the
   * half-done expiry worth failing on.
   */
  async function seatedCount(t: Backend, roomId: Id<'rooms'>): Promise<number> {
    return (await t.query(api.players.roster, { roomId })).length;
  }

  /**
   * Desertion checks the room still has scheduled against itself.
   *
   * Named as well as room-scoped, because two of the room's own checks take a
   * `roomId`: this counts `expireRoom` and never the unjoined check every room
   * carries from birth.
   */
  async function pendingExpiryChecks(t: Backend, roomId: Id<'rooms'>): Promise<number> {
    return await t.run(async (ctx) => {
      const scheduled = await ctx.db.system.query('_scheduled_functions').collect();

      return scheduled.filter((job) => {
        const [args] = job.args as [{ readonly roomId?: Id<'rooms'> }];
        return (
          job.state.kind === 'pending' &&
          args.roomId === roomId &&
          job.name.endsWith(':expireRoom')
        );
      }).length;
    });
  }

  it('deletes the room and its players ten minutes after the last phone goes quiet', async () => {
    const t = convexTest(schema, modules);
    const room = await t.mutation(api.rooms.createRoom, {});
    await seatPlayer(t, room.code, 'Ada');
    await seatPlayer(t, room.code, 'Grace');

    // Both phones leave with the party. Nothing beats again, so the last word
    // the room had was their joins.
    await elapse(t, TEN_MINUTES - 1_000);
    expect(await t.query(api.rooms.stillOpen, { roomId: room.roomId })).toBe(true);
    expect(await seatedCount(t, room.roomId)).toBe(2);

    await elapse(t, 1_000);

    expect(await t.query(api.rooms.stillOpen, { roomId: room.roomId })).toBe(false);
    expect(await seatedCount(t, room.roomId)).toBe(0);
  });

  it('leaves a room alone for as long as one phone is still beating', async () => {
    const t = convexTest(schema, modules);
    const room = await t.mutation(api.rooms.createRoom, {});
    await seatPlayer(t, room.code, 'Ada');
    const grace = await seatPlayer(t, room.code, 'Grace');

    // Ada's phone is in a pocket and has been away for most of the evening;
    // Grace is sitting in front of the television. One phone is a party.
    await elapseBeating(t, [grace.sessionToken], TEN_MINUTES + 60_000);

    expect(await t.query(api.rooms.stillOpen, { roomId: room.roomId })).toBe(true);
    expect(await seatedCount(t, room.roomId)).toBe(2);
  });

  it('starts the ten minutes again when somebody comes back', async () => {
    const t = convexTest(schema, modules);
    const room = await t.mutation(api.rooms.createRoom, {});
    const ada = await seatPlayer(t, room.code, 'Ada');

    // Five minutes of nothing, and then Ada's phone says one word and goes
    // quiet again. The check already pending comes due at the original ten
    // minutes and must not take a room somebody was in five minutes ago.
    await elapse(t, 5 * 60_000);
    await t.mutation(api.players.heartbeat, { sessionToken: ada.sessionToken });

    await elapse(t, 5 * 60_000);
    expect(await t.query(api.rooms.stillOpen, { roomId: room.roomId })).toBe(true);

    // Ten minutes after that one word, and not a moment sooner, the room goes.
    await elapse(t, 5 * 60_000);
    expect(await t.query(api.rooms.stillOpen, { roomId: room.roomId })).toBe(false);
  });

  it('gives an expired room’s code back to the pool', async () => {
    const t = convexTest(schema, modules);
    const room = await t.mutation(api.rooms.createRoom, {});
    await seatPlayer(t, room.code, 'Ada');

    await elapse(t, TEN_MINUTES);

    // Four letters is only enough alphabet if codes are recycled, which is what
    // `drawUnusedRoomCode` checking *live* rooms means. Nothing but expiry ever
    // made that true before now. The draw is pinned only after the party, since
    // minting a Session Token draws from the same `Math.random`.
    pinDrawsTo(room.code);
    const next = await t.mutation(api.rooms.createRoom, {});
    expect(next.code).toBe(room.code);
  });

  it('answers nothing to the Session Token of a player whose room expired', async () => {
    const t = convexTest(schema, modules);
    const room = await t.mutation(api.rooms.createRoom, {});
    const ada = await seatPlayer(t, room.code, 'Ada');

    await elapse(t, TEN_MINUTES);

    // A seat in a room that no longer exists is not a seat: the phone comes
    // back to the Join Screen rather than to a room nobody is showing.
    expect(await t.query(api.players.session, { sessionToken: ada.sessionToken })).toBeNull();
  });

  it('goes on running after the away checks of players it has deleted come due', async () => {
    const t = convexTest(schema, modules);
    const room = await t.mutation(api.rooms.createRoom, {});
    const ada = await seatPlayer(t, room.code, 'Ada');

    // Ada's phone beats until the last minute, so her away check is still
    // pending — against a row expiry is about to delete — when the room goes.
    await elapseBeating(t, [ada.sessionToken], TEN_MINUTES);
    await elapse(t, TEN_MINUTES);

    expect(await t.query(api.rooms.stillOpen, { roomId: room.roomId })).toBe(false);
    expect(await seatedCount(t, room.roomId)).toBe(0);
  });

  it('takes only its own room down with it', async () => {
    const t = convexTest(schema, modules);
    const ended = await t.mutation(api.rooms.createRoom, {});
    const carryingOn = await t.mutation(api.rooms.createRoom, {});
    await seatPlayer(t, ended.code, 'Ada');
    const grace = await seatPlayer(t, carryingOn.code, 'Grace');

    // Two televisions in one house, and one party goes home. Everything expiry
    // reads is scoped by the `by_room` index; a read that lost that scope would
    // count the other room's phones as this room's — or delete them.
    await elapseBeating(t, [grace.sessionToken], TEN_MINUTES + 60_000);

    expect(await t.query(api.rooms.stillOpen, { roomId: ended.roomId })).toBe(false);
    expect(await seatedCount(t, ended.roomId)).toBe(0);
    expect(await t.query(api.rooms.stillOpen, { roomId: carryingOn.roomId })).toBe(true);
    expect(await seatedCount(t, carryingOn.roomId)).toBe(1);
  });

  it('watches a deserted room with one expiry check, not one per player', async () => {
    const t = convexTest(schema, modules);
    const room = await t.mutation(api.rooms.createRoom, {});
    await seatPlayer(t, room.code, 'Ada');
    await seatPlayer(t, room.code, 'Grace');
    await seatPlayer(t, room.code, 'Linus');
    expect(await pendingExpiryChecks(t, room.roomId)).toBe(0);

    // A whole party puts its phones down at once, so every away check comes due
    // together. Scheduling from each of them would work and would leave two
    // spare deletions pending against a room the first one takes, with every
    // other test in this file still passing.
    await elapse(t, 15_000);

    expect(await pendingExpiryChecks(t, room.roomId)).toBe(1);
  });

  it('stops a running game’s clock as it deletes the room', async () => {
    const t = convexTest(schema, modules);
    const room = await t.mutation(api.rooms.createRoom, {});
    const host = await seatPlayer(t, room.code, 'Ada');
    await seatPlayer(t, room.code, 'Grace');

    // A game is running, so the room has a deadline scheduled against itself.
    await t.mutation(api.games.startGame, { sessionToken: host.sessionToken, gameId: 'trivia' });

    // The party leaves mid-game and the phones go quiet. Rather than run the
    // clock forward — which would fire the deadline itself and leave nothing to
    // cancel — the last-seen stamps are aged past the window and the desertion
    // check is run once with the game's clock still pending. This is the case
    // `players.leaveRoom` covers by hand: a room ending while a game is live.
    await t.run(async (ctx) => {
      const stale = Date.now() - (TEN_MINUTES + 1_000);
      for (const player of await ctx.db.query('players').collect()) {
        await ctx.db.patch(player._id, { lastSeenAt: stale });
      }
    });

    await t.mutation(internal.rooms.expireRoom, { roomId: room.roomId });

    expect(await t.query(api.rooms.stillOpen, { roomId: room.roomId })).toBe(false);

    // The question's own deadline is cancelled, not left to fire into a room that
    // has gone — asserted as `leaveRoom`'s twin does, since `reachDeadline`
    // tolerates a missing room and a test that only checked for no crash would
    // pass with the cancel deleted.
    const deadlines = await t.run(async (ctx) =>
      (await ctx.db.system.query('_scheduled_functions').collect()).filter(
        (job) => job.name === 'games:reachDeadline',
      ),
    );
    expect(deadlines).toHaveLength(1);
    expect(deadlines[0]?.state.kind).toBe('canceled');
  });

  /**
   * The room's other clock: the one for a room that has never had a player, and
   * so has no last heartbeat for the ten minutes above to run from.
   *
   * The first two are one sentence read in both directions: a television showing
   * a Room Code to a party that has not arrived keeps it, and a room nobody ever
   * arrives at is eventually let go. The fourth is the one a naive fix breaks —
   * a party that *did* arrive keeps their room however late they walked in, and
   * a Room Code taken off a working television mid-party is the failure this
   * clock risks and the only one it can cause.
   */
  describe('a room nobody has joined', () => {
    /** Every scheduled function this backend gave up on. */
    async function failedChecks(t: Backend): Promise<readonly string[]> {
      return await t.run(async (ctx) => {
        const scheduled = await ctx.db.system.query('_scheduled_functions').collect();

        return scheduled.filter((job) => job.state.kind === 'failed').map((job) => job.name);
      });
    }

    it('keeps its Room Code for the whole of the window', async () => {
      const t = convexTest(schema, modules);
      const room = await t.mutation(api.rooms.createRoom, {});

      // A television switched on before the guests arrive. Nobody has left this
      // room, so nothing has expired — and taking its code away while somebody
      // across the room is reading it off the screen is the one thing expiry
      // must never do.
      await elapse(t, UNJOINED_ROOM_EXPIRY_MS - 1_000);

      expect(await t.query(api.rooms.stillOpen, { roomId: room.roomId })).toBe(true);
    });

    it('is deleted once the window passes with nobody in it', async () => {
      const t = convexTest(schema, modules);
      const room = await t.mutation(api.rooms.createRoom, {});

      // The television was switched off, or the evening never happened. Either
      // way the room has heard nothing from anybody since it was minted, and
      // holding it forever is what leaked the codes.
      await elapse(t, UNJOINED_ROOM_EXPIRY_MS);

      expect(await t.query(api.rooms.stillOpen, { roomId: room.roomId })).toBe(false);
    });

    it('gives its Room Code back to the pool', async () => {
      const t = convexTest(schema, modules);
      const room = await t.mutation(api.rooms.createRoom, {});

      await elapse(t, UNJOINED_ROOM_EXPIRY_MS);

      // The point of the deletion rather than a side effect of it: `createRoom`
      // draws against live rooms, so a room held forever is a code spent
      // forever.
      pinDrawsTo(room.code);
      const next = await t.mutation(api.rooms.createRoom, {});
      expect(next.code).toBe(room.code);
    });

    it('stops being one the moment somebody joins', async () => {
      const t = convexTest(schema, modules);
      const room = await t.mutation(api.rooms.createRoom, {});

      // A television on all afternoon, and the guests walk in a minute before
      // the window comes due — the latest they can, and so the tightest version
      // of the case this clock must never break. The check fires in the middle
      // of their evening and has to find nothing to do: a Room Code taken off a
      // television mid-party is the failure a naive fix here produces.
      await elapse(t, UNJOINED_ROOM_EXPIRY_MS - 60_000);
      const ada = await seatPlayer(t, room.code, 'Ada');
      await elapseBeating(t, [ada.sessionToken], 5 * 60_000);

      expect(await t.query(api.rooms.stillOpen, { roomId: room.roomId })).toBe(true);
      expect(await seatedCount(t, room.roomId)).toBe(1);
    });

    it('does not trip over a room its party has already ended', async () => {
      const t = convexTest(schema, modules);
      const room = await t.mutation(api.rooms.createRoom, {});
      await seatPlayer(t, room.code, 'Ada');

      // A party arrives, plays, and goes home: desertion takes the room long
      // before the window comes due against it. The check that arrives afterwards
      // finds no room at all, which is a state it has to survive rather than
      // throw on — a failing scheduled function is invisible from every screen.
      await elapse(t, TEN_MINUTES);
      expect(await t.query(api.rooms.stillOpen, { roomId: room.roomId })).toBe(false);

      await elapse(t, UNJOINED_ROOM_EXPIRY_MS);

      expect(await failedChecks(t)).toEqual([]);
      expect(await t.query(api.rooms.stillOpen, { roomId: room.roomId })).toBe(false);
    });
  });
});
