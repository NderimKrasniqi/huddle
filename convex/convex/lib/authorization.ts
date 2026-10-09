import type { GameLifecycleRejection, GamePlayerId } from '@huddle/domain';
import { ConvexError, v } from 'convex/values';

import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

type DatabaseContext = Pick<QueryCtx, 'db'>;

/** Find the seat represented by a durable Phone session token. */
export async function playerForSession(
  ctx: DatabaseContext,
  sessionToken: string,
): Promise<Doc<'players'> | null> {
  return await ctx.db
    .query('players')
    .withIndex('by_session_token', (q) => q.eq('sessionToken', sessionToken))
    .first();
}

/** Require the seat and live room represented by a Phone token. */
export async function requirePlayerSession(
  ctx: MutationCtx,
  sessionToken: string,
): Promise<{ player: Doc<'players'>; room: Doc<'rooms'> }> {
  const player = await playerForSession(ctx, sessionToken);
  const room = player === null ? null : await ctx.db.get(player.roomId);

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
  const { player, room } = await requirePlayerSession(ctx, sessionToken);

  if (room.hostPlayerId !== player._id) {
    throw new ConvexError<GameLifecycleRejection>({ kind: 'notHost' });
  }

  return { player, room };
}

/** The credentials a room view may be asked with: a Phone seat or the room's TV. */
export const roomViewerArgs = {
  sessionToken: v.optional(v.string()),
  tvSessionToken: v.optional(v.string()),
};

type RoomViewer = { readonly kind: 'tv' } | { readonly kind: 'player'; readonly playerId: GamePlayerId };

/**
 * Who is looking at `roomId`: one of its seated players, from the Session Token
 * a phone presents, or its television, from the TV session credential it opened
 * the room with. Anybody else — no token, a stale one, another room's — is
 * `undefined`, and a room view shows them nothing. A phone naming itself is a
 * claim, so the seat is looked up rather than taken on the client's word.
 *
 * The cost, written down so it is not rediscovered: the caller's own `players`
 * or `tvSessions` row joins the query's read set, and each heartbeat patches it,
 * so a client's own beat re-runs its own room views. It is one client's beat
 * rather than every beat in the room, and the alternative is trusting a
 * client-supplied identity, which is the claim this lookup exists to refuse.
 */
export async function roomViewer(
  ctx: DatabaseContext,
  roomId: Id<'rooms'>,
  credentials: { readonly sessionToken?: string; readonly tvSessionToken?: string },
): Promise<RoomViewer | undefined> {
  if (credentials.sessionToken !== undefined) {
    const player = await playerForSession(ctx, credentials.sessionToken);
    if (player !== null && player.roomId === roomId) return { kind: 'player', playerId: player._id };
  }

  if (credentials.tvSessionToken !== undefined) {
    const tvSessionToken = credentials.tvSessionToken;
    const tv = await ctx.db
      .query('tvSessions')
      .withIndex('by_session_token', (q) => q.eq('sessionToken', tvSessionToken))
      .first();
    if (tv !== null && tv.roomId === roomId) return { kind: 'tv' };
  }

  return undefined;
}
