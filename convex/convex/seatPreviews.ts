import { isAvatarId, isGuestId, NICKNAME_MAX_LENGTH, normalizeRoomCode, ROOM_CODE_LENGTH, ROOM_PLAYER_CAP } from '@huddle/domain';
import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import { internalMutation, mutation, type MutationCtx, query } from './_generated/server';
import { roomViewer, roomViewerArgs } from './lib/authorization';
import { playersInRoom } from './lib/presence';
import { limitSeatPreview } from './lib/rateLimits';
import { avatarValidator } from './schema';

/**
 * How long a preview lives without word from its phone. The join form
 * refreshes it about every 10 seconds, so one missed beat is not enough to
 * drop it, and a phone that put itself away is gone from the TV soon after.
 */
export const SEAT_PREVIEW_TTL_MS = 20_000;

/** Remove a preview and the expiry check still waiting on it. */
export async function deleteSeatPreview(ctx: MutationCtx, preview: Doc<'seatPreviews'>): Promise<void> {
  if (preview.expiryJob !== undefined) await ctx.scheduler.cancel(preview.expiryJob);
  await ctx.db.delete('seatPreviews', preview._id);
}

/**
 * Someone on the join form tells the TV what they are picking: an arriving
 * seat with their avatar and the name as typed so far.
 *
 * Best effort by design. It is not a seat and not a reservation — two people
 * can preview the same avatar, and `joinRoom` still decides who gets it — so
 * anything that does not fit (no such room, a full room, more previews than
 * free seats, a malformed key) is quietly not shown rather than an error the
 * join form would have to explain. Only the rate limit throws.
 */
export const previewSeat = mutation({
  args: { code: v.string(), previewKey: v.string(), nickname: v.string(), avatar: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const code = normalizeRoomCode(args.code);
    if (code.length !== ROOM_CODE_LENGTH || !isGuestId(args.previewKey) || !isAvatarId(args.avatar)) return null;

    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', code))
      .first();
    if (room === null) return null;

    await limitSeatPreview(ctx, room._id, args.previewKey);

    const nickname = Array.from(args.nickname.trim()).slice(0, NICKNAME_MAX_LENGTH).join('');
    const now = Date.now();
    let existing = await ctx.db
      .query('seatPreviews')
      .withIndex('by_preview_key', (q) => q.eq('previewKey', args.previewKey))
      .first();
    // A visit that wandered to another room starts over there.
    if (existing !== null && existing.roomId !== room._id) {
      await deleteSeatPreview(ctx, existing);
      existing = null;
    }

    if (existing === null) {
      const seated = await playersInRoom(ctx, room._id);
      const held = new Set(seated.map((player) => player.avatar));
      const previews = await ctx.db
        .query('seatPreviews')
        .withIndex('by_room', (q) => q.eq('roomId', room._id))
        .collect();
      // Never more arriving seats than the room has free ones. A preview whose
      // avatar is already held is not drawn, so it does not use a seat up.
      const shown = previews.filter((preview) => !held.has(preview.avatar)).length;
      if (seated.length + shown >= ROOM_PLAYER_CAP) return null;
    }

    const previewId =
      existing === null
        ? await ctx.db.insert('seatPreviews', {
            roomId: room._id,
            previewKey: args.previewKey,
            nickname,
            avatar: args.avatar,
            updatedAt: now,
          })
        : existing._id;
    // One pending check per preview: a refresh replaces it rather than adding one.
    if (existing?.expiryJob !== undefined) await ctx.scheduler.cancel(existing.expiryJob);
    const expiryJob = await ctx.scheduler.runAfter(SEAT_PREVIEW_TTL_MS, internal.seatPreviews.expireSeatPreview, {
      previewId,
      updatedAt: now,
    });
    await ctx.db.patch('seatPreviews', previewId, { nickname, avatar: args.avatar, updatedAt: now, expiryJob });
    return null;
  },
});

/** The join form is done with its preview: it joined, went back, or closed. */
export const clearSeatPreview = mutation({
  args: { previewKey: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const preview = await ctx.db
      .query('seatPreviews')
      .withIndex('by_preview_key', (q) => q.eq('previewKey', args.previewKey))
      .first();
    if (preview !== null) await deleteSeatPreview(ctx, preview);
    return null;
  },
});

/**
 * The pending check for a preview its phone stopped refreshing. Each refresh
 * cancels the previous check, and the `updatedAt` match guards against one
 * that was already running when it was replaced.
 */
export const expireSeatPreview = internalMutation({
  args: { previewId: v.id('seatPreviews'), updatedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const preview = await ctx.db.get('seatPreviews', args.previewId);
    if (preview !== null && preview.updatedAt === args.updatedAt) {
      await ctx.db.delete('seatPreviews', preview._id);
    }
    return null;
  },
});

/**
 * The arriving seats, for the room's TV only. A preview whose avatar a
 * seated player already holds is left out: either that player is the one who
 * just joined from it, or the avatar is spoken for and the join form will say
 * so.
 */
export const arrivals = query({
  args: { roomId: v.id('rooms'), ...roomViewerArgs },
  returns: v.array(v.object({ previewId: v.id('seatPreviews'), nickname: v.string(), avatar: avatarValidator })),
  handler: async (ctx, args) => {
    const viewer = await roomViewer(ctx, args.roomId, args);
    if (viewer?.kind !== 'tv') return [];

    const held = new Set((await playersInRoom(ctx, args.roomId)).map((player) => player.avatar));
    const previews = await ctx.db
      .query('seatPreviews')
      .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
      .collect();
    return previews
      .filter((preview) => !held.has(preview.avatar))
      .map((preview) => ({ previewId: preview._id, nickname: preview.nickname, avatar: preview.avatar }));
  },
});
