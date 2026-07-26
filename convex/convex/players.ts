import { NICKNAME_MAX_LENGTH, ROOM_PLAYER_CAP } from '@huddle/game-core';
import { ConvexError, v } from 'convex/values';

import { mutation, query } from './_generated/server';

/**
 * Why a join was refused. A `ConvexError` for the reason `createRoom` throws
 * one (see rooms.ts): Convex redacts the message of anything else to "Server
 * Error", while `data` crosses the wire intact. The Controller's join screen
 * picks its copy by `kind` — the rejections are told apart programmatically,
 * never by matching on a message someone may reword.
 */
export type JoinRejection =
  | { readonly kind: 'roomNotFound'; readonly code: string }
  | { readonly kind: 'roomFull'; readonly cap: number }
  | { readonly kind: 'nameTaken'; readonly nickname: string }
  | { readonly kind: 'nameUnusable'; readonly maxLength: number };

/**
 * A Room Code as the room holds it. The code is a token in a player's hands —
 * read off a TV across the room, typed with a stray space, or arriving from a
 * hand-written deep link — so its case and padding are the phone's accident,
 * not a different room.
 */
function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Whether two nicknames are the same name. Case and surrounding spaces do not
 * count: two seats reading "Sam" and "sam" are one name to everyone looking at
 * the TV, and the rule exists for exactly those people.
 */
function sameNickname(one: string, other: string): boolean {
  return one.trim().toLowerCase() === other.trim().toLowerCase();
}

/**
 * Whether a trimmed nickname is one a room can hold: something, and not too
 * much of it.
 *
 * The server asks because it cannot assume anybody asked before it. `joinRoom`
 * is public and Huddle has no auth by design (docs/tech-stack.md), so the join
 * screen's own check is a courtesy to whoever is typing, not a promise about
 * what arrives. A nickname of nothing but spaces would seat a player the TV
 * cannot name; an unbounded one is a string every client in the room re-reads
 * on every roster update.
 *
 * Length is counted in characters rather than UTF-16 units, so a name written
 * in emoji is measured the way its owner sees it (as in `playerInitials`).
 */
function isUsableNickname(trimmedNickname: string): boolean {
  return trimmedNickname !== '' && [...trimmedNickname].length <= NICKNAME_MAX_LENGTH;
}

/**
 * Puts a phone in a room: the Controller sends the code from the TV and the
 * nickname its owner typed, and the room gains a seat.
 *
 * The two rules it enforces against the room — the ten-player cap and one
 * nickname per room — are read-then-write, and both hold exactly rather than
 * probably for the reason
 * `createRoom`'s code draw does (rooms.ts): Convex mutations are serializable
 * transactions, and the index read below joins this transaction's read set. A
 * concurrent `joinRoom` inserting into the same room writes into the range this
 * one read, which invalidates it, so Convex re-runs this mutation against the
 * committed rows — where the seat count is one higher and the nickname is
 * taken. Ten phones tapping Join in the same instant therefore seat ten
 * players, not eleven, and one "Sam", not two.
 *
 * Reading the room's whole roster rather than looking one nickname up is
 * deliberate: it is the read the cap needs anyway, it is bounded by
 * `ROOM_PLAYER_CAP` rows, and it puts every player of the room in the read set
 * — which is precisely the range a competing join writes into.
 */
export const joinRoom = mutation({
  args: {
    code: v.string(),
    nickname: v.string(),
  },
  returns: v.object({ playerId: v.id('players'), roomId: v.id('rooms') }),
  handler: async (ctx, args) => {
    const code = normalizeRoomCode(args.code);
    const nickname = args.nickname.trim();

    // Answered first, and without touching the database: whether a name can be
    // worn at all is a property of what was typed, not of any room. The trim
    // above happens before the question, so a nickname of spaces is a nickname
    // of nothing.
    if (!isUsableNickname(nickname)) {
      throw new ConvexError<JoinRejection>({
        kind: 'nameUnusable',
        maxLength: NICKNAME_MAX_LENGTH,
      });
    }

    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', code))
      .first();

    if (room === null) {
      throw new ConvexError<JoinRejection>({ kind: 'roomNotFound', code });
    }

    const seated = await ctx.db
      .query('players')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .collect();

    // The cap is checked before the nickname on purpose: when both rules bite,
    // "name taken" would send someone off to think of another name for a room
    // that has no seat left for any name.
    if (seated.length >= ROOM_PLAYER_CAP) {
      throw new ConvexError<JoinRejection>({ kind: 'roomFull', cap: ROOM_PLAYER_CAP });
    }

    if (seated.some((player) => sameNickname(player.nickname, nickname))) {
      throw new ConvexError<JoinRejection>({ kind: 'nameTaken', nickname });
    }

    const playerId = await ctx.db.insert('players', { roomId: room._id, nickname });

    return { playerId, roomId: room._id };
  },
});

/**
 * A room's roster in join order — the TV subscribes to this and redraws its
 * seats the moment a player lands, which is the whole of "the name appears on
 * the TV".
 *
 * It projects each player rather than returning the row: the TV is a renderer
 * and gets what it draws. Player rows grow private fields in Phase 2 (the
 * Session Token above all), and a projection is what keeps them off a screen
 * the entire room is looking at.
 */
export const roster = query({
  args: { roomId: v.id('rooms') },
  returns: v.array(v.object({ playerId: v.id('players'), nickname: v.string() })),
  handler: async (ctx, args) => {
    const seated = await ctx.db
      .query('players')
      .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
      .collect();

    return seated.map((player) => ({ playerId: player._id, nickname: player.nickname }));
  },
});
