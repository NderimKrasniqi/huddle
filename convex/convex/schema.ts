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
   * A Player: one phone in a room. For now a player is a nickname on a roster —
   * the Session Token that lets them rejoin, the claimed color, the Host flag
   * and presence all arrive with the Phase 2 tasks that own them.
   */
  players: defineTable({
    /** The room this player is in. Players never move between rooms. */
    roomId: v.id('rooms'),
    /** The name on the TV roster: trimmed, and unique within the room. */
    nickname: v.string(),
  })
    // `joinRoom` reads a room's players to enforce the cap and the nickname
    // rule, and the TV's roster is that same read. Convex orders an index by
    // its fields then `_creationTime`, so reading it returns the room's players
    // in join order — which is the order the TV's seats fill.
    .index('by_room', ['roomId']),
});
