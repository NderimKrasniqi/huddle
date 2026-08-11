import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * A claimed avatar, as the database and the `roster` projection both state it.
 *
 * The ten ids are written out rather than built from game-core's list because a
 * schema is a contract with the stored data and reads better stated than
 * computed; `players.test.ts` holds the two in step by storing every id
 * game-core knows.
 */
export const avatarValidator = v.union(
  v.literal('fox'),
  v.literal('green-alien'),
  v.literal('pink-bunny'),
  v.literal('blue-robot'),
  v.literal('purple-owl'),
  v.literal('yellow-robot'),
  v.literal('red-robot'),
  v.literal('teal-bear'),
  v.literal('mint-cat'),
  v.literal('puppy'),
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
     * it, and becomes empty again after the last player deliberately leaves.
     * The first join into either empty state fills it (see `joinRoom`). An away
     * Host with seats still present keeps the pointer when nobody active can
     * take over, since a seated room with no host cannot recover its controls.
     */
    hostPlayerId: v.optional(v.id('players')),
    /**
     * The Host's live game draft. It is separate from `game` so browsing and
     * editing settings can be mirrored to the TV without seeding a runtime.
     * Optional for backwards compatibility with rooms created before setup
     * drafts existed.
     */
    setup: v.optional(
      v.object({
        gameId: v.string(),
        settings: v.record(v.string(), v.string()),
        mode: v.union(v.literal('quick'), v.literal('standard'), v.literal('custom')),
      }),
    ),
    /**
     * The game this room is playing, and the state it is at — absent while the
     * room is in its lobby.
     *
     * The room's phase is read off this rather than stored beside it: a room
     * holding a game is in a game, a room holding none is in its lobby, and
     * written this way there is no such row as an in-game room with nothing
     * running (see `roomPhase` in game-core). One field, so `startGame` and
     * `endGame` are each a single patch that cannot half-succeed.
     *
     * `state` is `v.any()` because it belongs to the game and not to the room:
     * the hub stores and returns it without reading it, which is the whole of
     * what makes a second game an entry in the Registry rather than a schema
     * change here. The module's own types are what give it shape, on both
     * sides of the wire.
     */
    game: v.optional(
      v.object({
        /** Which installed module — `GameMetadata.id`, as the Registry knows it. */
        gameId: v.string(),
        /** Settings locked at Start; optional for legacy running games. */
        settings: v.optional(v.record(v.string(), v.string())),
        /** Preset/custom mode locked at Start; optional for legacy games. */
        mode: v.optional(
          v.union(v.literal('quick'), v.literal('standard'), v.literal('custom')),
        ),
        /**
         * Decoder version for the opaque state stored below.
         *
         * Optional so this schema can land on a deployment that already holds
         * rooms. Convex validates a new schema against every existing document,
         * and a game stored before versioning existed has no version to offer —
         * requiring one here would block the deploy on exactly the data the
         * field was invented to cope with. Absent means "written before there
         * were versions", which every reader already treats as undecodable:
         * `running.stateVersion !== game.stateVersion` fails the runtime rather
         * than guessing at a format (`games.ts`, `lib/gameRuntime.ts`).
         */
        stateVersion: v.optional(v.number()),
        state: v.any(),
        /**
         * The room's clock for the beat it is on: the scheduled function that
         * will raise the module's Game Deadline, absent on a beat that has none
         * (see `windGameClock` in games.ts).
         *
         * Stored so that it can be *cancelled*. At most one deadline is pending
         * for a room and it belongs to the beat the room is on, which is what
         * makes ending a game enough to stop its countdown — a clock left
         * running would fire into whatever the room did next, and a Host who
         * restarts the same game inside twenty seconds would watch its first
         * question reveal itself early.
         *
         * It lives inside `game` rather than beside it so that it goes with the
         * game in the same patch: there is no room row holding a clock for a
         * game it is not playing. It is not part of the `running` query — the
         * clients are shown the game's state and nothing about the scheduler.
         */
        deadline: v.optional(v.id('_scheduled_functions')),
        /**
         * When that deadline comes due, so that what is left of it can be
         * *read* as well as cancelled: the hub times every event against this
         * and hands the remainder to the rules (`GameEvent.msRemaining`), which
         * is the whole of how a game can pay for answering quickly without a
         * reducer ever touching a clock.
         *
         * Written and cleared with `deadline` above, since a room holding one
         * without the other is a clock that cannot be read or cannot be
         * stopped. Absent on a beat with no clock, and on a room dealt its beat
         * by a deployment older than this field — which reads as an event the
         * room could not time, and never as an event that arrived instantly.
         */
        deadlineAt: v.optional(v.number()),
        /** Remaining time captured while either the TV or a player pause is active. */
        pausedRemainingMs: v.optional(v.number()),
        /** A confirmed player disconnect is holding the game for the Host's choice. */
        playerPaused: v.optional(v.literal(true)),
      }),
    ),
    /**
     * Stable lifecycle projection of the TV connection.
     *
     * Optional for the same reason as `stateVersion` above: Convex validates a
     * new schema against every room already stored, and rooms opened before this
     * field existed cannot grow one. Absent means **not away**, which is what
     * every reader already asks for — the checks are written `tvAway === true`
     * and `tvAway !== true` rather than as a bare boolean, so a room from an
     * older deployment reads as a television that is present. Both `openRoom`
     * paths write it explicitly, so only historical rooms are ever without it.
     */
    tvAway: v.optional(v.boolean()),
    /**
     * Which card the Host is browsing in the lobby: a position in the Registry's
     * ordered list, which the TV's carousel follows.
     *
     * An index and not a game id, because browsing is a walk along an ordered
     * list — "the third card" has to mean the same thing on the television and
     * on the phone, and ids would leave the two to agree on an order
     * separately. Absent means nobody has browsed yet, which reads as the first
     * card; `browsingIndex` in game-registry is what turns either into a
     * position this build actually has.
     */
    browsingGameIndex: v.optional(v.number()),
    // A room's age is `_creationTime`, and its expiry needs no field of its own:
    // the ten minutes run from the last heartbeat the room heard, which is
    // already written down as the newest `lastSeenAt` among its players. A
    // stored deadline here would be a second copy of that, refreshed on every
    // beat — ten phones writing the one row a whole party shares.
  })
    // `openRoom` reads this index before it mints a code, and joining a room
    // is a lookup by the code someone typed on their phone.
    .index('by_code', ['code']),

  /**
   * A Player: one phone in a room. A player is a nickname on a roster, the
   * Session Token that phone rejoins with, the avatar they claimed, and whether
   * the room is still hearing from it. Being the Host is not among these: it is the room's `hostPlayerId`,
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
     * The avatar this player claimed, held by nobody else in their room.
     *
     * Required, where the colour it replaced was optional. A colour was claimed
     * *after* joining, so a seat had to be drawable before the choice existed;
     * the avatar is chosen on the join form and arrives with the join, so there
     * is no unclaimed state and nothing has to draw one.
     */
    avatar: avatarValidator,
  })
    // `joinRoom` reads a room's players to enforce the cap and the nickname
    // rule, and the TV's roster is that same read. Convex orders an index by
    // its fields then `_creationTime`, so reading it returns the room's players
    // in join order — which is the order the TV's seats fill.
    .index('by_room', ['roomId'])
    // A phone coming back from a force-quit knows its token and nothing else;
    // this is how that token finds the seat it still holds.
    .index('by_session_token', ['sessionToken']),

  /** High-churn TV presence, kept off the shared room document. */
  tvSessions: defineTable({
    roomId: v.id('rooms'),
    sessionToken: v.string(),
    lastSeenAt: v.number(),
    away: v.boolean(),
    /** Generation of the one scheduled silence-check chain, absent on legacy rows. */
    awayCheckGeneration: v.optional(v.number()),
  })
    .index('by_session_token', ['sessionToken'])
    .index('by_room', ['roomId']),

});
