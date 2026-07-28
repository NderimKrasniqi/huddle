import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * A claimed color, as the database and the `roster` projection both state it.
 *
 * The ten names are written out rather than built from game-core's list because
 * a schema is a contract with the stored data and reads better stated than
 * computed; `players.test.ts` holds the two in step by storing every name
 * game-core knows.
 */
export const playerColorValidator = v.union(
  v.literal('cobalt'),
  v.literal('grape'),
  v.literal('plum'),
  v.literal('punch'),
  v.literal('tangerine'),
  v.literal('yellow'),
  v.literal('lime'),
  v.literal('green'),
  v.literal('lagoon'),
  v.literal('sky'),
);

export default defineSchema({
  /**
   * A Room: the shared session a TV creates and phones join. Players, the
   * selected game and its state join this table as the phases that own them
   * land — see docs/implementation-plan.md.
   */
  rooms: defineTable({
    /** The Room Code shown on the TV. Held by at most one room at a time. */
    code: v.string(),
    /**
     * The Host: the player who holds room control. A pointer on the room rather
     * than a flag on a player, because "exactly one host" is a fact about the
     * room — written this way the invariant is structural, and no sequence of
     * joins, silences and returns can leave two players wearing the pill or a
     * transfer half-done.
     *
     * Optional because a room is minted by a television before anybody is in
     * it: the first join fills it (see `joinRoom`), and it stays filled from
     * then on — an away Host with nobody active to take over keeps it, since a
     * room with no host is a room that cannot start a game.
     */
    hostPlayerId: v.optional(v.id('players')),
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
   * hearing from it — the claimed color arrives with the Phase 2 task that owns
   * it. Being the Host is not among these: it is the room's `hostPlayerId`,
   * because it is a fact about the room and not about the player.
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
    /**
     * The color this player has claimed, held by nobody else in their room.
     * Absent until they tap a swatch — a player is on the roster from the
     * moment they join, and the picker is the screen they land on, so a seat
     * has to be drawable without one.
     */
    color: v.optional(playerColorValidator),
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
