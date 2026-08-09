import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';

/** Cancel a room game deadline when a lifecycle transition removes the game. */
export async function cancelDeadline(
  ctx: MutationCtx,
  deadline: Id<'_scheduled_functions'> | undefined,
): Promise<void> {
  if (deadline !== undefined) await ctx.scheduler.cancel(deadline);
}

/** Delete every player and TV credential owned by a room before its row. */
export async function deleteRoomChildren(ctx: MutationCtx, roomId: Id<'rooms'>): Promise<void> {
  const players = await ctx.db
    .query('players')
    .withIndex('by_room', (q) => q.eq('roomId', roomId))
    .collect();
  for (const player of players) await ctx.db.delete('players', player._id);

  const sessions = await ctx.db
    .query('tvSessions')
    .withIndex('by_room', (q) => q.eq('roomId', roomId))
    .collect();
  for (const session of sessions) await ctx.db.delete('tvSessions', session._id);
}
