import type { HostControlRejection } from '@huddle/game-core';
import { ConvexError } from 'convex/values';

import type { Doc } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';

/**
 * The gate every Host-only write over a room's people stands behind.
 *
 * `players.transferHost`, `players.removePlayer` and `rooms.endRoom` are all the
 * Host acting on the room's seats, so all three ask the same two questions the
 * game lifecycle does (`games.ts`, `roomThisPhoneRuns`): which player holds this
 * phone, and does the room point at them. The Session Token is the only thing a
 * phone presents, so the lookup starts there and a phone naming itself is never
 * believed.
 *
 * It sits in a file of its own rather than in either caller because the two that
 * would otherwise host it already point at each other — `players.ts` reaches for
 * `rooms.watchForDesertion` — and a shared gate is not worth an import cycle.
 * One copy is the point of it: a change to what being the Host means here, a
 * grace period or an audit write, must not reach two of the three.
 */
export async function hostSeatAndRoom(
  ctx: MutationCtx,
  sessionToken: string,
): Promise<{ actor: Doc<'players'>; room: Doc<'rooms'> }> {
  const actor = await ctx.db
    .query('players')
    .withIndex('by_session_token', (q) => q.eq('sessionToken', sessionToken))
    .first();

  if (actor === null) {
    throw new ConvexError<HostControlRejection>({ kind: 'notInRoom' });
  }

  const room = await ctx.db.get(actor.roomId);

  // The room ended under this phone — it expired, or another thumb closed it.
  // Refused rather than ignored, as a color claim on a lost seat is: the screen
  // this was tapped on is not in a room any more.
  if (room === null) {
    throw new ConvexError<HostControlRejection>({ kind: 'notInRoom' });
  }

  // Asked at the tap and never cached, because the host moves: a player who
  // joined second holds it the moment the room gives up on the first.
  if (room.hostPlayerId !== actor._id) {
    throw new ConvexError<HostControlRejection>({ kind: 'notHost' });
  }

  return { actor, room };
}
