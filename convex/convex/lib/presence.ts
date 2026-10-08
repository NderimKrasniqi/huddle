import type { GamePlayer } from '@huddle/domain';

import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

type DatabaseContext = Pick<QueryCtx, 'db'>;
type WriteContext = Pick<MutationCtx, 'db'>;

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

/** When this phone was last heard from: its presence row, else its own join time. */
async function playerSeenAt(ctx: DatabaseContext, player: Doc<'players'>): Promise<number> {
  const row = await ctx.db
    .query('presence')
    .withIndex('by_player', (q) => q.eq('playerId', player._id))
    .first();
  return Math.max(player.lastSeenAt, row?.lastSeenAt ?? 0);
}

/**
 * The same seats with `lastSeenAt` brought up to their latest heartbeat. Silence
 * checks run on these; screens never read heartbeats, so they never re-run on one.
 */
export async function withSeenAt(
  ctx: DatabaseContext,
  players: readonly Doc<'players'>[],
): Promise<Doc<'players'>[]> {
  return await Promise.all(players.map(async (player) => ({ ...player, lastSeenAt: await playerSeenAt(ctx, player) })));
}

/** Record a phone's heartbeat without touching the `players` row screens read. */
export async function touchPlayer(ctx: WriteContext, player: Doc<'players'>, now: number): Promise<void> {
  const row = await ctx.db
    .query('presence')
    .withIndex('by_player', (q) => q.eq('playerId', player._id))
    .first();
  if (row === null) {
    await ctx.db.insert('presence', { roomId: player.roomId, playerId: player._id, lastSeenAt: now });
  } else {
    await ctx.db.patch('presence', row._id, { lastSeenAt: now });
  }
}

/** When this TV was last heard from: its presence row, else the session's own field. */
export async function tvSeenAt(ctx: DatabaseContext, session: Doc<'tvSessions'>): Promise<number> {
  const row = await ctx.db
    .query('presence')
    .withIndex('by_tv_session', (q) => q.eq('tvSessionId', session._id))
    .first();
  return Math.max(session.lastSeenAt, row?.lastSeenAt ?? 0);
}

/** Record a TV heartbeat without touching the `tvSessions` row room views read. */
export async function touchTv(ctx: WriteContext, session: Doc<'tvSessions'>, now: number): Promise<void> {
  const row = await ctx.db
    .query('presence')
    .withIndex('by_tv_session', (q) => q.eq('tvSessionId', session._id))
    .first();
  if (row === null) {
    await ctx.db.insert('presence', { roomId: session.roomId, tvSessionId: session._id, lastSeenAt: now });
  } else {
    await ctx.db.patch('presence', row._id, { lastSeenAt: now });
  }
}

/** Drop the heartbeat row of a phone or TV whose own row is being deleted. */
export async function deletePresenceOf(
  ctx: WriteContext,
  owner: { readonly playerId: Id<'players'> } | { readonly tvSessionId: Id<'tvSessions'> },
): Promise<void> {
  const row =
    'playerId' in owner
      ? await ctx.db.query('presence').withIndex('by_player', (q) => q.eq('playerId', owner.playerId)).first()
      : await ctx.db.query('presence').withIndex('by_tv_session', (q) => q.eq('tvSessionId', owner.tvSessionId)).first();
  if (row !== null) await ctx.db.delete('presence', row._id);
}
