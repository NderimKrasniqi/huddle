import type { GameLifecycleRejection } from '@huddle/game-core';
import { ConvexError } from 'convex/values';

import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';

/** Find the seat represented by a durable Controller session token. */
export async function playerForSession(
  ctx: MutationCtx,
  sessionToken: string,
): Promise<Doc<'players'> | null> {
  return await ctx.db
    .query('players')
    .withIndex('by_session_token', (q) => q.eq('sessionToken', sessionToken))
    .first();
}

/** Require that a token owns a seat in the requested room. */
export async function requirePlayerInRoom(
  ctx: MutationCtx,
  sessionToken: string,
  roomId: Id<'rooms'>,
): Promise<{ player: Doc<'players'>; room: Doc<'rooms'> }> {
  const player = await playerForSession(ctx, sessionToken);
  const room = player === null || player.roomId !== roomId ? null : await ctx.db.get(roomId);

  if (player === null || room === null) {
    throw new ConvexError<GameLifecycleRejection>({ kind: 'notInRoom' });
  }

  return { player, room };
}

/** Require that a token belongs to the current Host. */
export async function requireRoomHost(
  ctx: MutationCtx,
  sessionToken: string,
): Promise<{ player: Doc<'players'>; room: Doc<'rooms'> }> {
  const player = await playerForSession(ctx, sessionToken);
  const room = player === null ? null : await ctx.db.get(player.roomId);

  if (player === null || room === null) {
    throw new ConvexError<GameLifecycleRejection>({ kind: 'notInRoom' });
  }

  if (room.hostPlayerId !== player._id) {
    throw new ConvexError<GameLifecycleRejection>({ kind: 'notHost' });
  }

  return { player, room };
}
