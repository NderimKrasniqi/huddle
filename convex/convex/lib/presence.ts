import type { GamePlayer } from '@huddle/domain';

import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';

type DatabaseContext = Pick<QueryCtx, 'db'>;

/** Read all phone presence rows for a room in join order. */
export async function playersInRoom(
  ctx: DatabaseContext,
  roomId: Id<'rooms'>,
): Promise<Doc<'players'>[]> {
  return await ctx.db
    .query('players')
    .withIndex('by_room', (q) => q.eq('roomId', roomId))
    .collect();
}

/** Project room seats into the only roster shape game logic may observe. */
export async function gamePlayersInRoom(
  ctx: DatabaseContext,
  roomId: Id<'rooms'>,
): Promise<GamePlayer[]> {
  const players = await playersInRoom(ctx, roomId);
  return players.map((player) => ({
    playerId: player._id,
    nickname: player.nickname,
    away: player.away,
    avatar: player.avatar,
  }));
}

/** Return the room's current away seats without exposing any session token. */
export async function awayPlayerIds(
  ctx: DatabaseContext,
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
