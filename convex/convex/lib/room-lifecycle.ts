import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { cancelDeadline } from './game-clock';
import { playersInRoom } from './presence';

/** Delete every player and TV credential owned by a room before its row. */
export async function deleteRoomChildren(ctx: MutationCtx, roomId: Id<'rooms'>): Promise<void> {
  const players = await playersInRoom(ctx, roomId);
  for (const player of players) await ctx.db.delete('players', player._id);

  const sessions = await ctx.db
    .query('tvSessions')
    .withIndex('by_room', (q) => q.eq('roomId', roomId))
    .collect();
  for (const session of sessions) await ctx.db.delete('tvSessions', session._id);
}

/** Delete a room, its owned rows, and any game clock as one lifecycle action. */
export async function deleteRoom(ctx: MutationCtx, room: Doc<'rooms'>): Promise<void> {
  await cancelDeadline(ctx, room.game?.deadline);
  await deleteRoomChildren(ctx, room._id);
  await ctx.db.delete('rooms', room._id);
}
