import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';

/** Read all phone presence rows for a room in join order. */
export async function playersInRoom(
  ctx: MutationCtx,
  roomId: Id<'rooms'>,
): Promise<Doc<'players'>[]> {
  return await ctx.db
    .query('players')
    .withIndex('by_room', (q) => q.eq('roomId', roomId))
    .collect();
}

/** Return the room's current away seats without exposing any session token. */
export async function awayPlayerIds(
  ctx: MutationCtx,
  roomId: Id<'rooms'>,
): Promise<Id<'players'>[]> {
  const players = await playersInRoom(ctx, roomId);
  return players.filter((player) => player.away).map((player) => player._id);
}

/** Age of the oldest observed player heartbeat, or undefined for an empty room. */
export function roomSilenceMs(players: readonly Doc<'players'>[], now: number): number | undefined {
  if (players.length === 0) return undefined;
  return now - Math.max(...players.map((player) => player.lastSeenAt));
}
