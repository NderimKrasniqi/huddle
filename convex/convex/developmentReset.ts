import { ConvexError, v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { deleteRoom } from './lib/roomLifecycle';

const countValidator = v.object({
  rooms: v.number(),
  memberships: v.number(),
  tvSessions: v.number(),
  games: v.number(),
});

/** Read-only cutover audit. It contains aggregate counts, never credentials. */
export const audit = query({
  args: {},
  returns: countValidator,
  handler: async (ctx) => {
    const [rooms, memberships, tvSessions] = await Promise.all([
      ctx.db.query('rooms').collect(),
      ctx.db.query('players').collect(),
      ctx.db.query('tvSessions').collect(),
    ]);
    return {
      rooms: rooms.length,
      memberships: memberships.length,
      tvSessions: tvSessions.length,
      games: rooms.filter((room) => room.game !== undefined).length,
    };
  },
});

/**
 * Development-only cutover reset. Operators must enable both environment
 * gates briefly and provide the confirmation literal; production is refused
 * even if the second gate was configured by mistake.
 */
export const reset = mutation({
  args: { confirmation: v.literal('RESET_DEVELOPMENT_ROOMS') },
  returns: countValidator,
  handler: async (ctx) => {
    const environment = (
      globalThis as typeof globalThis & {
        process?: { env?: Record<string, string | undefined> };
      }
    ).process?.env;

    if (
      environment?.HUDDLE_DEPLOYMENT_KIND !== 'development' ||
      environment.HUDDLE_ALLOW_DEVELOPMENT_RESET !== 'true'
    ) {
      throw new ConvexError({ kind: 'developmentResetDisabled' });
    }

    const beforeRooms = await ctx.db.query('rooms').collect();
    const memberships = await ctx.db.query('players').collect();
    const tvSessions = await ctx.db.query('tvSessions').collect();
    const games = beforeRooms.filter((room) => room.game !== undefined).length;
    for (const room of beforeRooms) await deleteRoom(ctx, room);

    return {
      rooms: beforeRooms.length,
      memberships: memberships.length,
      tvSessions: tvSessions.length,
      games,
    };
  },
});
