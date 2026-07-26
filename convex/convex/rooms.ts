import { generateRoomCode } from '@huddle/game-core';
import { ConvexError, v } from 'convex/values';

import { mutation, type MutationCtx } from './_generated/server';

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
 * How many codes `createRoom` draws before it gives up. With 456,976 codes and
 * a scope of roughly ten concurrent rooms, a single collision is already a
 * ~1-in-45,000 event, so ten collisions in a row means something is wrong
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
 * (Phase 2) its code returns to the pool, which is the intent — 4 letters is
 * only enough alphabet if codes are recycled.
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
