import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  /**
   * A Room: the shared session a TV creates and phones join. Players, the
   * selected game and its state join this table as the phases that own them
   * land — see docs/implementation-plan.md.
   */
  rooms: defineTable({
    /** The Room Code shown on the TV. Held by at most one room at a time. */
    code: v.string(),
    // A room's age is `_creationTime`. The 10-minute expiry clock (Phase 2)
    // starts from the last player leaving rather than from creation, so it will
    // need a field of its own instead of reusing this one.
  })
    // `createRoom` reads this index before it mints a code, and joining a room
    // is a lookup by the code someone typed on their phone.
    .index('by_code', ['code']),

  /**
   * A Player: one phone in a room. A player is a nickname on a roster, the
   * Session Token that phone rejoins with, and whether the room is still
   * hearing from it — the claimed color and the Host flag arrive with the
   * Phase 2 tasks that own them.
   */
  players: defineTable({
    /** The room this player is in. Players never move between rooms. */
    roomId: v.id('rooms'),
    /** The name on the TV roster: trimmed, and unique within the room. */
    nickname: v.string(),
    /**
     * The Session Token this player's phone holds. Minted by `joinRoom`, and
     * the only thing that identifies them afterwards — so it is returned to
     * that one phone and to nothing else (see the `roster` projection).
     */
    sessionToken: v.string(),
    /**
     * When this phone last said it was there: its join, or its most recent
     * heartbeat. Written on every beat, which is why the away flag is a stored
     * field beside it rather than something the roster works out from this one
     * — see `markAway` in players.ts.
     */
    lastSeenAt: v.number(),
    /**
     * Whether the room has stopped hearing from this phone. The one presence
     * fact the TV is told, and the only one it needs to draw a seat.
     */
    away: v.boolean(),
  })
    // `joinRoom` reads a room's players to enforce the cap and the nickname
    // rule, and the TV's roster is that same read. Convex orders an index by
    // its fields then `_creationTime`, so reading it returns the room's players
    // in join order — which is the order the TV's seats fill.
    .index('by_room', ['roomId'])
    // A phone coming back from a force-quit knows its token and nothing else;
    // this is how that token finds the seat it still holds.
    .index('by_session_token', ['sessionToken']),
});
