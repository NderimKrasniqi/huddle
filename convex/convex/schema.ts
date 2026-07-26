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
});
