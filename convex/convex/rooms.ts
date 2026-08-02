import { generateRoomCode, ROOM_EXPIRY_MS } from '@huddle/game-core';
import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, mutation, type MutationCtx, query } from './_generated/server';

/**
 * What `createRoom` rejects with when it cannot find a free Room Code. A
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
 * How many codes `createRoom` draws before it gives up. With 390,625 codes and
 * a scope of roughly ten concurrent rooms, a single collision is already a
 * ~1-in-39,000 event, so ten collisions in a row means something is wrong
 * (the alphabet, the randomness, or a table that never expires rooms) and the
 * TV should hear about it instead of the mutation spinning.
 */
const MAX_CODE_DRAWS = 10;

/**
 * A Room Code no live room holds.
 *
 * The read-then-insert this performs is safe because Convex mutations are
 * serializable transactions: the index read below joins the transaction's read
 * set, so a concurrent `createRoom` that inserts the same code invalidates this
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
 * Opens a room. The TV app calls this on launch and shows the returned code;
 * phones join by typing it or by scanning the QR that encodes it.
 */
export const createRoom = mutation({
  args: {},
  returns: v.object({ roomId: v.id('rooms'), code: v.string() }),
  handler: async (ctx) => {
    const code = await drawUnusedRoomCode(ctx);
    const roomId = await ctx.db.insert('rooms', { code });

    return { roomId, code };
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

/** Everyone in a room, in join order. */
async function seatedIn(ctx: MutationCtx, roomId: Id<'rooms'>): Promise<Doc<'players'>[]> {
  return await ctx.db
    .query('players')
    .withIndex('by_room', (q) => q.eq('roomId', roomId))
    .collect();
}

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
  return Date.now() - Math.max(...seated.map((player) => player.lastSeenAt));
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
  const seated = await seatedIn(ctx, roomId);

  // "Every player is away" is vacuously true of no players, and that reading
  // would expire the room a television is showing to a party that has not
  // arrived yet. A room nobody has joined has not been deserted — nobody has
  // left it — so its Room Code stays on the screen for as long as the TV is on.
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
 * `createRoom` draws from. The away checks still pending against those rows find
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

    const seated = await seatedIn(ctx, args.roomId);

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

    for (const player of seated) {
      await ctx.db.delete('players', player._id);
    }

    await ctx.db.delete('rooms', room._id);
    return null;
  },
});
