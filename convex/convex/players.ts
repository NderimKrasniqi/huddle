import {
  AWAY_AFTER_MS,
  generateSessionToken,
  type JoinRejection,
  NICKNAME_MAX_LENGTH,
  ROOM_PLAYER_CAP,
} from '@huddle/game-core';
import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { internalMutation, mutation, type MutationCtx, query } from './_generated/server';

// A join is refused with a `ConvexError` for the reason `createRoom` throws one
// (see rooms.ts): Convex redacts the message of anything else to "Server
// Error", while `data` crosses the wire intact. `JoinRejection` itself lives in
// game-core, because the Controller reads every one of these.

/**
 * A Room Code as the room holds it. The code is a token in a player's hands —
 * read off a TV across the room, typed with a stray space, or arriving from a
 * hand-written deep link — so its case and padding are the phone's accident,
 * not a different room.
 */
function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Whether two nicknames are the same name. Case and surrounding spaces do not
 * count: two seats reading "Sam" and "sam" are one name to everyone looking at
 * the TV, and the rule exists for exactly those people.
 */
function sameNickname(one: string, other: string): boolean {
  return one.trim().toLowerCase() === other.trim().toLowerCase();
}

/**
 * Whether a trimmed nickname is one a room can hold: something, and not too
 * much of it.
 *
 * The server asks because it cannot assume anybody asked before it. `joinRoom`
 * is public and Huddle has no auth by design (docs/tech-stack.md), so the join
 * screen's own check is a courtesy to whoever is typing, not a promise about
 * what arrives. A nickname of nothing but spaces would seat a player the TV
 * cannot name; an unbounded one is a string every client in the room re-reads
 * on every roster update.
 *
 * Length is counted in characters rather than UTF-16 units, so a name written
 * in emoji is measured the way its owner sees it (as in `playerInitials`).
 */
function isUsableNickname(trimmedNickname: string): boolean {
  return trimmedNickname !== '' && [...trimmedNickname].length <= NICKNAME_MAX_LENGTH;
}

/**
 * Watches one player for silence: `markAway` runs `after` milliseconds from now
 * and decides then whether the room has stopped hearing from their phone.
 *
 * Exactly one of these is pending for every player who is present, and nothing
 * ever cancels one — a check that finds the player still beating re-arms itself
 * for the moment their latest beat goes stale, so the chain runs for as long as
 * they are here and ends by marking them Away. Being away is therefore the same
 * thing as having no check pending, which is why `heartbeat` starts a chain only
 * for a player who *was* away, and why `joinRoom` starts the first one.
 */
async function watchForSilence(
  ctx: MutationCtx,
  playerId: Id<'players'>,
  after: number = AWAY_AFTER_MS,
): Promise<void> {
  await ctx.scheduler.runAfter(after, internal.players.markAway, { playerId });
}

/**
 * A player's place in a room, as the phone holding that seat is told it: which
 * room, which player row, and the two things the Controller draws — the Room
 * Code on its chip and the name the room knows them by.
 *
 * `joinRoom` returns one of these and so does `session`, because taking a seat
 * and finding it again land the Controller in the same place. The nickname
 * comes back from the row rather than from what was typed: after a force-quit
 * the phone has nothing but its token, and the name on the TV is the room's to
 * state.
 */
const playerSessionFields = {
  playerId: v.id('players'),
  roomId: v.id('rooms'),
  code: v.string(),
  nickname: v.string(),
};

/**
 * Puts a phone in a room: the Controller sends the code from the TV and the
 * nickname its owner typed, and the room gains a seat.
 *
 * The two rules it enforces against the room — the ten-player cap and one
 * nickname per room — are read-then-write, and both hold exactly rather than
 * probably for the reason
 * `createRoom`'s code draw does (rooms.ts): Convex mutations are serializable
 * transactions, and the index read below joins this transaction's read set. A
 * concurrent `joinRoom` inserting into the same room writes into the range this
 * one read, which invalidates it, so Convex re-runs this mutation against the
 * committed rows — where the seat count is one higher and the nickname is
 * taken. Ten phones tapping Join in the same instant therefore seat ten
 * players, not eleven, and one "Sam", not two.
 *
 * Reading the room's whole roster rather than looking one nickname up is
 * deliberate: it is the read the cap needs anyway, it is bounded by
 * `ROOM_PLAYER_CAP` rows, and it puts every player of the room in the read set
 * — which is precisely the range a competing join writes into.
 *
 * The Session Token it mints goes back to this phone alone. It is what makes
 * the seat survive the app: see `session` below.
 */
export const joinRoom = mutation({
  args: {
    code: v.string(),
    nickname: v.string(),
  },
  returns: v.object({ ...playerSessionFields, sessionToken: v.string() }),
  handler: async (ctx, args) => {
    const code = normalizeRoomCode(args.code);
    const nickname = args.nickname.trim();

    // Answered first, and without touching the database: whether a name can be
    // worn at all is a property of what was typed, not of any room. The trim
    // above happens before the question, so a nickname of spaces is a nickname
    // of nothing.
    if (!isUsableNickname(nickname)) {
      throw new ConvexError<JoinRejection>({
        kind: 'nameUnusable',
        maxLength: NICKNAME_MAX_LENGTH,
      });
    }

    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', code))
      .first();

    if (room === null) {
      throw new ConvexError<JoinRejection>({ kind: 'roomNotFound', code });
    }

    const seated = await ctx.db
      .query('players')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect();

    // The cap is checked before the nickname on purpose: when both rules bite,
    // "name taken" would send someone off to think of another name for a room
    // that has no seat left for any name.
    if (seated.length >= ROOM_PLAYER_CAP) {
      throw new ConvexError<JoinRejection>({ kind: 'roomFull', cap: ROOM_PLAYER_CAP });
    }

    if (seated.some((player) => sameNickname(player.nickname, nickname))) {
      throw new ConvexError<JoinRejection>({ kind: 'nameTaken', nickname });
    }

    const sessionToken = generateSessionToken();
    const playerId = await ctx.db.insert('players', {
      roomId: room._id,
      nickname,
      sessionToken,
      // Joining is the first thing this phone says, so it is also the first
      // beat: a phone that joins and is never heard from again goes away on the
      // same schedule as one that stops mid-party.
      lastSeenAt: Date.now(),
      away: false,
    });
    await watchForSilence(ctx, playerId);

    return { playerId, roomId: room._id, code, nickname, sessionToken };
  },
});

/**
 * The seat a Session Token still holds, or `null` if it holds none.
 *
 * This is rejoining, and it is a query rather than a mutation because nothing
 * changes: force-quitting an app does not give up a seat, so a phone coming
 * back is not asking for one — it is asking which one is already its own. That
 * is the whole reason the roster cannot grow a duplicate. The Controller reads
 * this before it will show anybody a join form (`apps/controller/src/session.ts`).
 *
 * The room is read too, and a token whose room is gone answers `null`: the
 * Controller cannot draw the Room Code chip without it, and a seat in a room
 * that no longer exists is not a seat. Room expiry (Phase 2) deletes players
 * with their room, so this is a guard against the order of a deletion rather
 * than an expected state.
 */
export const session = query({
  args: { sessionToken: v.string() },
  returns: v.union(v.null(), v.object(playerSessionFields)),
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query('players')
      .withIndex('by_session_token', (q) => q.eq('sessionToken', args.sessionToken))
      .first();

    if (player === null) {
      return null;
    }

    const room = await ctx.db.get(player.roomId);

    if (room === null) {
      return null;
    }

    return {
      playerId: player._id,
      roomId: room._id,
      code: room.code,
      nickname: player.nickname,
    };
  },
});

/**
 * "Still here" — the Controller's heartbeat, sent every `HEARTBEAT_INTERVAL_MS`
 * while the app is in front of its owner and not at all while it is not
 * (`apps/controller/src/presence.ts`). Backgrounding a phone is therefore the
 * same event to a room as losing it: the beats stop, and the room finds out by
 * not being told.
 *
 * The Session Token is what says whose beat this is, for the reason the token
 * exists at all. Keying it on the `playerId` the roster hands to every screen in
 * the room would let any client hold any other player present, and presence is
 * the one thing a phone asserts about itself.
 *
 * A token no seat answers to is accepted and ignored rather than refused: the
 * seat may have gone with an expired room, and a phone beating into a room that
 * is no longer there has nothing to do about it that this mutation could tell it.
 */
export const heartbeat = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query('players')
      .withIndex('by_session_token', (q) => q.eq('sessionToken', args.sessionToken))
      .first();

    if (player === null) {
      return null;
    }

    await ctx.db.patch(player._id, { lastSeenAt: Date.now(), away: false });

    // Coming back: the chain that had been watching them ended when it marked
    // them away, so their return is what starts a new one.
    if (player.away) {
      await watchForSilence(ctx, player._id);
    }

    return null;
  },
});

/**
 * The room noticing that a phone has gone quiet — scheduled by whoever last
 * heard from it (see `watchForSilence`), and the only thing that sets Away.
 *
 * It is a scheduled write rather than a comparison made when the roster is read,
 * because "away" has to reach a television nobody is touching. A Convex query
 * re-runs when the rows it read change, not when time passes, so a roster that
 * worked out away-ness from `lastSeenAt` would go on showing a room full of
 * present players until somebody happened to join. A write is what pushes; this
 * is the write.
 *
 * Internal, because it is the room talking to itself: no phone gets to declare
 * a player away.
 */
export const markAway = internalMutation({
  args: { playerId: v.id('players') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);

    // The row can be gone by now — room expiry deletes players — and an already
    // away player is a chain that has done its work.
    if (player === null || player.away) {
      return null;
    }

    const silence = Date.now() - player.lastSeenAt;

    if (silence < AWAY_AFTER_MS) {
      // They have beaten since this check was scheduled. Re-arm for the moment
      // the beat we *have* heard goes stale, so the room acts at the deadline
      // rather than a whole interval past it.
      await watchForSilence(ctx, player._id, AWAY_AFTER_MS - silence);
      return null;
    }

    await ctx.db.patch(player._id, { away: true });
    return null;
  },
});

/**
 * A room's roster in join order — the TV subscribes to this and redraws its
 * seats the moment a player lands, which is the whole of "the name appears on
 * the TV".
 *
 * It projects each player rather than returning the row: the TV is a renderer
 * and gets what it draws. A player row carries the phone's Session Token, and
 * this projection is what keeps it off a screen the entire room is looking at.
 *
 * `away` is here because a seat is drawn differently for a player whose phone
 * has gone quiet; `lastSeenAt` is not, because the TV has no clock the room
 * agrees with and no business deciding this.
 */
export const roster = query({
  args: { roomId: v.id('rooms') },
  returns: v.array(
    v.object({ playerId: v.id('players'), nickname: v.string(), away: v.boolean() }),
  ),
  handler: async (ctx, args) => {
    const seated = await ctx.db
      .query('players')
      .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
      .collect();

    return seated.map((player) => ({
      playerId: player._id,
      nickname: player.nickname,
      away: player.away,
    }));
  },
});
