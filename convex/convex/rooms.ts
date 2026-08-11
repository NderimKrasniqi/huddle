import {
  AWAY_AFTER_MS,
  generateRoomCode,
  ROOM_EXPIRY_MS,
} from '@huddle/game-core';
import { MINUTE, RateLimiter } from '@convex-dev/rate-limiter';
import { ConvexError, v } from 'convex/values';

import { components, internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, mutation, type MutationCtx, query } from './_generated/server';
import { pauseGameClock, resumePausedGameClock } from './lib/game-clock';
import { playersInRoom, roomSilenceMs } from './lib/presence';
import { deleteRoom } from './lib/room-lifecycle';

/**
 * What `openRoom` rejects with when it cannot find a free Room Code. A
 * `ConvexError` rather than a plain `Error` because Convex redacts the message
 * of anything else to "Server Error" before the client sees it; `data` crosses
 * the wire intact, so the TV pairing screen can match on `kind` and tell the
 * room-is-unavailable story instead of showing an opaque failure.
 */
export type RoomCodeExhausted = {
  readonly kind: 'roomCodeExhausted';
  readonly draws: number;
};

/**
 * How many codes `openRoom` draws before it gives up. With 456,976 codes and
 * a scope of roughly ten concurrent rooms, a single collision is already a
 * ~1-in-46,000 event, so ten collisions in a row means something is wrong
 * (the alphabet, the randomness, or a table that never expires rooms) and the
 * TV should hear about it instead of the mutation spinning.
 */
const MAX_CODE_DRAWS = 10;

const TV_SESSION_MAX_SILENCE_MS = AWAY_AFTER_MS;

export type TvRateLimitRejection = {
  readonly kind: 'tvRateLimited';
  readonly retryAfterMs: number;
};

const tvRateLimiter = new RateLimiter(components.rateLimiter, {
  tvNewRooms: { kind: 'token bucket', rate: 10, period: MINUTE, capacity: 20 },
});

/**
 * Keep exactly one silence check pending for a present TV.
 *
 * The check re-arms itself against the latest heartbeat until it marks the TV
 * away. Heartbeats therefore start a new chain only when the previous chain
 * ended in that away state; arming on every beat would accumulate one
 * scheduled function every three seconds for the lifetime of the room.
 */
async function watchTvForSilence(
  ctx: MutationCtx,
  tvSessionId: Id<'tvSessions'>,
  generation: number | undefined,
  after: number = TV_SESSION_MAX_SILENCE_MS,
): Promise<void> {
  const nextGeneration = (generation ?? 0) + 1;
  await ctx.scheduler.runAfter(after, internal.rooms.markTvAway, {
    tvSessionId,
    generation: nextGeneration,
  });
  await ctx.db.patch(tvSessionId, { awayCheckGeneration: nextGeneration });
}

/**
 * A Room Code no live room holds.
 *
 * The read-then-insert this performs is safe because Convex mutations are
 * serializable transactions: the index read below joins the transaction's read
 * set, so a concurrent `openRoom` that inserts the same code invalidates this
 * one, and Convex re-runs it against the committed row — where the code now
 * reads as taken and another is drawn. Uniqueness among live rooms is therefore
 * a guarantee, not a probability.
 *
 * Nothing here keeps a code unique against *deleted* rooms: once a room expires
 * its code returns to the pool, which is the intent — 4 letters is only enough
 * alphabet if codes are recycled. `expireRoom` is what recycles them.
 */
async function drawUnusedRoomCode(ctx: MutationCtx): Promise<string> {
  for (let draw = 0; draw < MAX_CODE_DRAWS; draw += 1) {
    const code = generateRoomCode();
    const holder = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', code))
      .first();

    if (holder === null) {
      return code;
    }
  }

  throw new ConvexError<RoomCodeExhausted>({
    kind: 'roomCodeExhausted',
    draws: MAX_CODE_DRAWS,
  });
}

/**
 * Open (or recover) the one room owned by a durable TV credential.
 *
 * This is the sole production room-opening API. A process restart cannot
 * strand a second room behind the same screen: the token lookup and room insert
 * are in one transaction, which also makes concurrent cold-start calls
 * idempotent.
 */
export const openRoom = mutation({
  args: { tvSessionToken: v.string() },
  returns: v.object({ roomId: v.id('rooms'), code: v.string() }),
  handler: async (ctx, args) => {
    const token = args.tvSessionToken.trim();
    if (token.length === 0 || token.length > 256) {
      throw new ConvexError({ kind: 'tvSessionInvalid' });
    }

    const now = Date.now();
    const existing = await ctx.db
      .query('tvSessions')
      .withIndex('by_session_token', (q) => q.eq('sessionToken', token))
      .first();
    let replacingStaleSession = false;

    if (existing !== null) {
      const room = await ctx.db.get(existing.roomId);
      if (room !== null) {
        await ctx.db.patch(existing._id, { lastSeenAt: now, away: false });
        await restoreTvRoom(ctx, room, existing._id, now);
        if (existing.away || existing.awayCheckGeneration === undefined) {
          await watchTvForSilence(ctx, existing._id, existing.awayCheckGeneration);
        }
        return { roomId: room._id, code: room.code };
      }
      // A stale session row is not an identity failure. Clean it and let this
      // same durable token open a replacement without spending a new-token
      // rate-limit slot.
      await ctx.db.delete('tvSessions', existing._id);
      replacingStaleSession = true;
    }

    if (!replacingStaleSession) await consumeTvOpenToken(ctx);
    const code = await drawUnusedRoomCode(ctx);
    const roomId = await ctx.db.insert('rooms', { code, tvAway: false });
    const sessionId = await ctx.db.insert('tvSessions', {
      roomId,
      sessionToken: token,
      lastSeenAt: now,
      away: false,
    });
    await watchTvForSilence(ctx, sessionId, undefined);

    return { roomId, code };
  },
});

/** Token-bucket admission for *new* TV credentials only. */
async function consumeTvOpenToken(ctx: MutationCtx): Promise<void> {
  const status = await tvRateLimiter.limit(ctx, 'tvNewRooms', { key: 'global' });
  if (!status.ok) {
    throw new ConvexError<TvRateLimitRejection>({
      kind: 'tvRateLimited',
      retryAfterMs: status.retryAfter,
    });
  }
}

/**
 * Restores an away TV and, when possible, its exact game clock. Invalid or
 * missing runtimes are deliberately left to the game projection to report as
 * unavailable; this lifecycle mutation never manufactures game state.
 */
async function restoreTvRoom(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  sessionId: Id<'tvSessions'>,
  now: number,
): Promise<void> {
  const session = await ctx.db.get(sessionId);
  if (session === null || room.tvAway !== true) return;

  const running = room.game;
  if (running === undefined) {
    await ctx.db.patch(room._id, { tvAway: false });
    return;
  }
  // The TV is back, but a player disconnect still holds the game. Clear only
  // the TV boundary and leave the shared remainder for the Host's decision or
  // the final player's return.
  if (running.playerPaused === true) {
    await ctx.db.patch(room._id, { tvAway: false });
    return;
  }

  await ctx.db.patch(room._id, {
    tvAway: false,
    game: await resumePausedGameClock(ctx, room, running, now),
  });
}

/** TV heartbeat; the TV token is the only authority over this presence row. */
export const tvHeartbeat = mutation({
  args: { tvSessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('tvSessions')
      .withIndex('by_session_token', (q) => q.eq('sessionToken', args.tvSessionToken))
      .first();
    if (session === null) return null;
    const room = await ctx.db.get(session.roomId);
    if (room === null) {
      await ctx.db.delete('tvSessions', session._id);
      return null;
    }
    const now = Date.now();
    await ctx.db.patch(session._id, { lastSeenAt: now, away: false });
    await restoreTvRoom(ctx, room, session._id, now);
    if (session.away || session.awayCheckGeneration === undefined) {
      await watchTvForSilence(ctx, session._id, session.awayCheckGeneration);
    }
    return null;
  },
});

/** Scheduled silence check for the TV's high-churn session row. */
export const markTvAway = internalMutation({
  args: {
    tvSessionId: v.id('tvSessions'),
    // Optional so callbacks scheduled by the previous deployment can land and
    // fold themselves into the new single-chain protocol.
    generation: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.tvSessionId);
    if (session === null || session.away) return null;

    // A modern callback owns the generation stored on the row. A legacy
    // callback owns it only until one callback has established that field;
    // every duplicate that follows then becomes inert.
    if (
      (args.generation === undefined && session.awayCheckGeneration !== undefined) ||
      (args.generation !== undefined && args.generation !== session.awayCheckGeneration)
    ) {
      return null;
    }

    const silence = Date.now() - session.lastSeenAt;
    if (silence < TV_SESSION_MAX_SILENCE_MS) {
      await watchTvForSilence(
        ctx,
        session._id,
        session.awayCheckGeneration,
        TV_SESSION_MAX_SILENCE_MS - silence,
      );
      return null;
    }
    const room = await ctx.db.get(session.roomId);
    if (room === null) {
      await ctx.db.delete('tvSessions', session._id);
      return null;
    }
    const game = await pauseGameClock(ctx, room, Date.now());
    await ctx.db.patch(session._id, { away: true });
    await ctx.db.patch(room._id, {
      tvAway: true,
      game,
    });
    // Expiry is ten minutes from the last TV heartbeat, not ten minutes after
    // the 13-second away marker happens to run.
    await ctx.scheduler.runAfter(Math.max(0, ROOM_EXPIRY_MS - silence), internal.rooms.expireTvRoom, {
      tvSessionId: session._id,
    });
    return null;
  },
});

/** Deletes a TV-held room only if the TV has stayed silent for the full window. */
export const expireTvRoom = internalMutation({
  args: { tvSessionId: v.id('tvSessions') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.tvSessionId);
    if (session === null || Date.now() - session.lastSeenAt < ROOM_EXPIRY_MS) return null;
    const room = await ctx.db.get(session.roomId);
    if (room === null) {
      await ctx.db.delete('tvSessions', session._id);
      return null;
    }
    await deleteRoom(ctx, room);
    return null;
  },
});

/**
 * Whether the room a television is showing is still there.
 *
 * The TV app is untouched after launch, so a room that expires under it has to
 * reach it as a push: this is the subscription that carries the news, and
 * `false` is what sends the pairing screen off to open a fresh room
 * (`apps/tv/app/index.tsx`). It cannot ride the `roster` query instead, because
 * an expired room and an empty one are the same empty roster and want opposite
 * treatment — one is a screen to replace, the other is the screen working.
 */
export const stillOpen = query({
  args: { roomId: v.id('rooms') },
  returns: v.boolean(),
  handler: async (ctx, args) => (await ctx.db.get(args.roomId)) !== null,
});

/** TV connection projection used by recovery UI; it contains no game state. */
export const connection = query({
  args: { roomId: v.id('rooms') },
  returns: v.union(v.null(), v.object({ away: v.boolean() })),
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (room === null) return null;
    const session = await ctx.db
      .query('tvSessions')
      .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
      .first();
    return { away: room.tvAway === true || session?.away === true };
  },
});

/**
 * How long it has been since the room last heard from *anybody* — the age of the
 * most recent heartbeat any of its players sent.
 *
 * This is the clock room expiry runs on, and it is the players' own `lastSeenAt`
 * rather than anything stored on the room: the last phone to go quiet is the
 * moment the party ended, and it is already written down. An empty roster has no
 * most recent anything and comes back `Infinity`, which is why both callers rule
 * that case out before asking.
 */
function roomSilence(seated: readonly Doc<'players'>[]): number {
  return roomSilenceMs(seated, Date.now()) ?? Number.POSITIVE_INFINITY;
}

/**
 * Starts the room's ten minutes, if the phone that has just gone quiet was the
 * last one it was hearing from. Called by `markAway`, which is the only place a
 * player becomes Away and therefore the only way a room can become deserted.
 *
 * Where `handOverRoom` asks `lastSeenAt` who is still here, this asks the `away`
 * flag — deliberately, and for the opposite reason. The Host has to move at the
 * first check that comes due, so it cannot wait on flags that lag; expiry must
 * happen at the *last* one, and the flag is what makes that exact. When a whole
 * party puts its phones down together every check comes due at once, and each
 * one finds every other player silent by the clock — so a clock-based test would
 * schedule a deletion per player for the one room. Against the flags, only the
 * last check to run sees a room where everybody is away, so a deserted room gets
 * exactly one expiry check and the room's players are never counted twice.
 *
 * Nothing cancels it, as nothing cancels an away check: a player coming back is
 * a beat, and a beat must not cost the room a write (ten phones × every three
 * seconds is contention on the one row a whole party shares). `expireRoom`
 * checks the clock again when it runs instead.
 */
export async function watchForDesertion(ctx: MutationCtx, roomId: Id<'rooms'>): Promise<void> {
  const seated = await playersInRoom(ctx, roomId);

  // "Every player is away" is vacuously true of no players, and that reading
  // would expire the room a television is showing to a party that has not
  // arrived yet. A room nobody has joined has not been deserted — nobody has
  // left it — and the TV session owns its lifetime instead.
  if (seated.length === 0 || !seated.every((player) => player.away)) {
    return;
  }

  // From the last beat the room heard, not from this moment: the room has
  // already spent `AWAY_AFTER_MS` of the party's absence noticing it, and the
  // ten minutes are counted from when the last player actually went quiet.
  const remaining = Math.max(0, ROOM_EXPIRY_MS - roomSilence(seated));
  await ctx.scheduler.runAfter(remaining, internal.rooms.expireRoom, { roomId });
}

/**
 * The end of the party: a room that has heard nothing from anybody for
 * `ROOM_EXPIRY_MS` is deleted, and its players with it.
 *
 * It re-reads the clock rather than trusting the schedule it arrived on, for the
 * reason `markAway` does: somebody may have come back in the meantime, and a
 * check that fires early has to leave the room standing. It does not re-arm
 * itself when that happens — the phone that returned will go quiet again, and
 * that silence schedules a fresh check through `markAway`. Every way into a
 * deserted room goes through there, so there is always exactly one check ahead
 * of a room that is on its way out.
 *
 * Deleting the players is what makes the expiry complete rather than cosmetic:
 * their Session Tokens stop answering (`players.session`), so the phones that
 * held them come back to a Join Screen, and the room's code returns to the pool
 * `openRoom` draws from. The away checks still pending against those rows find
 * nothing and do nothing.
 *
 * Internal, because it is the room ending itself: no phone gets to close a room
 * other people are in.
 */
export const expireRoom = internalMutation({
  args: { roomId: v.id('rooms') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);

    // Two checks can be pending against one room — a party that came back and
    // left again schedules a second — so the room may already be gone.
    if (room === null) {
      return null;
    }

    const seated = await playersInRoom(ctx, args.roomId);

    // Somebody has beaten since this check was scheduled, so the room is not
    // deserted and this check has nothing to do but leave it standing. Nothing
    // is scheduled in its place: the phone that came back will go quiet again,
    // and `markAway` starts the ten minutes over then. An empty room is a
    // television waiting for guests and is left alone (see `watchForDesertion`);
    // unreachable here, since only a deserted room is ever watched, but it is
    // what stops the `Infinity` of a roster with no most-recent beat from
    // reading as expired.
    if (seated.length === 0 || roomSilence(seated) < ROOM_EXPIRY_MS) {
      return null;
    }

    // A durable TV keeps an otherwise empty room alive. Player desertion and
    // TV silence are independent clocks; the latter owns deletion for a TV
    // session, so this check prevents a quiet roster from closing a live TV.
    const tvSession = await ctx.db
      .query('tvSessions')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .first();
    if (tvSession !== null && Date.now() - tvSession.lastSeenAt < ROOM_EXPIRY_MS) {
      return null;
    }

    // A running game's clock, stopped before the room goes. A deadline left pending
    // would fire into a room that no longer exists: harmless, since
    // `reachDeadline` finds nothing, but it is the room's own scheduled work and
    // the room ending is where it stops, however the room comes to end.
    await deleteRoom(ctx, room);
    return null;
  },
});

// `endRoom` was here: the Host's control that deleted the room and every seat
// in it at once. `players.leaveRoom` replaced it. The scope's "end the room"
// became "leave", available to everybody rather than to the Host alone. The TV
// credential now owns production room lifetime, so there is still no caller for
// a Host-only power to close a room other people are in.
