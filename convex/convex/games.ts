import {
  defaultSettings,
  refusalToStart,
  roomPhase,
  type GameLifecycleRejection,
  type GamePlayer,
} from '@huddle/game-core';
import { browsingIndex, gameLogicById } from '@huddle/game-registry/logic';
import { ConvexError, v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { mutation, type MutationCtx, query } from './_generated/server';

/**
 * The game lifecycle: the Host starting a game, and the Host ending it.
 *
 * These are the only two writes that move a room between its phases, and both
 * are a single patch of the room's `game` field — which is the room's phase, as
 * the schema explains. The game's own events are not here: those go to the
 * module's `reduce`, which arrives with the reducer task
 * (docs/implementation-plan.md).
 *
 * Nothing in this file names a game. The Registry answers what is installed and
 * the module answers what its state begins as, so trivia being the only entry
 * today is a fact about `@huddle/game-registry` and not about the hub.
 */

/**
 * The room this phone runs, or the refusal that says why it does not.
 *
 * Both mutations below are Host-only, and both have to answer two questions to
 * know it: which player is holding this phone, and whether the room points at
 * them. The Session Token is the only thing a phone presents — a phone never
 * names itself and is never believed when it does — so the lookup starts there.
 */
async function seatThisPhoneHolds(
  ctx: MutationCtx,
  sessionToken: string,
): Promise<{ player: Doc<'players'>; room: Doc<'rooms'> }> {
  const player = await ctx.db
    .query('players')
    .withIndex('by_session_token', (q) => q.eq('sessionToken', sessionToken))
    .first();

  // Refused rather than ignored, as with a color claim: a phone whose seat has
  // gone would otherwise sit on a screen the room is not in.
  if (player === null) {
    throw new ConvexError<GameLifecycleRejection>({ kind: 'notInRoom' });
  }

  const room = await ctx.db.get(player.roomId);

  // The room expired between this phone's last read and this tap.
  if (room === null) {
    throw new ConvexError<GameLifecycleRejection>({ kind: 'notInRoom' });
  }

  return { player, room };
}

/**
 * The room this phone *runs*, or the refusal that says why it does not.
 *
 * The seat lookup above plus the one question the lifecycle adds: does the room
 * point at this player? Playing a game asks only for the seat, which is why the
 * two are separate — `sendEvent` is open to everybody at the table.
 */
async function roomThisPhoneRuns(
  ctx: MutationCtx,
  sessionToken: string,
): Promise<Doc<'rooms'>> {
  const { player, room } = await seatThisPhoneHolds(ctx, sessionToken);

  // The host moves — a player who joined second holds it the moment the room
  // gives up on the first — so this is asked at the tap and never cached.
  if (room.hostPlayerId !== player._id) {
    throw new ConvexError<GameLifecycleRejection>({ kind: 'notHost' });
  }

  return room;
}

/** Everyone in a room, in join order, as a game is given them. */
async function playersFor(ctx: MutationCtx, roomId: Id<'rooms'>): Promise<GamePlayer[]> {
  const seated = await ctx.db
    .query('players')
    .withIndex('by_room', (q) => q.eq('roomId', roomId))
    .collect();

  // The `roster` projection minus `host`: a game must not be able to tell who
  // is running the room, or it would eventually treat them differently.
  return seated.map((player) => ({
    playerId: player._id,
    nickname: player.nickname,
    away: player.away,
    color: player.color,
  }));
}

/**
 * The Host starts a game: the room leaves its lobby holding the module's
 * opening state, and every client follows it there.
 *
 * The state is seeded here rather than on the phone that tapped, because it is
 * the room's state and not that phone's — every screen in the room reads it
 * from the same row, so there is no moment where the television and a
 * Controller disagree about what was dealt.
 */
export const startGame = mutation({
  args: { sessionToken: v.string(), gameId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = await roomThisPhoneRuns(ctx, args.sessionToken);

    // Whether a game exists at all is a property of what was sent, not of any
    // room — but it is asked after the Host check, so a non-Host learns only
    // that it is not the Host.
    const game = gameLogicById(args.gameId);

    if (game === undefined) {
      throw new ConvexError<GameLifecycleRejection>({
        kind: 'gameNotInstalled',
        gameId: args.gameId,
      });
    }

    const players = await playersFor(ctx, room._id);
    const refusal = refusalToStart(roomPhase(room.game), players.length, game.metadata.playerRange);

    if (refusal !== null) {
      throw new ConvexError<GameLifecycleRejection>(refusal);
    }

    await ctx.db.patch(room._id, {
      game: {
        gameId: game.metadata.id,
        state: game.createInitialState({
          players,
          settings: defaultSettings(game.settingsSchema),
        }),
      },
    });

    return null;
  },
});

/**
 * The Host ends the game: the room returns to its lobby, and nothing else about
 * it changes.
 *
 * The roster, the host and the Room Code are untouched on purpose — this is the
 * party deciding to play something else, not the party ending. Only the `game`
 * field is cleared, so there is no other state for an ending to get wrong.
 *
 * A second tap is not refused; `phaseAfter` explains why.
 */
export const endGame = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = await roomThisPhoneRuns(ctx, args.sessionToken);

    // Unconditional: ending has no refusal to check (see `refusalToStart`), so
    // there is nothing between the Host check and the patch. `undefined` is how
    // Convex unsets an optional field, which is the whole of returning to the
    // lobby — `phaseAfter('end')` is that field being absent.
    await ctx.db.patch(room._id, { game: undefined });
    return null;
  },
});

/**
 * The Host moves the carousel: the room remembers which card, and the TV
 * follows.
 *
 * Host-only like the rest of the lifecycle, and for the same reason — the
 * carousel is one shared surface, and a room where anybody could move it would
 * be a room where nobody could read it.
 *
 * The index is clamped rather than refused (`browsingIndex`): it is a position
 * in a list that differs between builds, so a phone browsing past what this
 * deployment installs gets the nearest card instead of an error. Browsing is
 * also allowed mid-game and simply has no effect on it — the carousel is lobby
 * furniture, and refusing would mean a Host whose thumb was still on the arrows
 * as a game started seeing a failure for something harmless.
 */
export const browseGame = mutation({
  args: { sessionToken: v.string(), index: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = await roomThisPhoneRuns(ctx, args.sessionToken);

    await ctx.db.patch(room._id, { browsingGameIndex: browsingIndex(args.index) });
    return null;
  },
});

/**
 * A player acts in the running game: the event goes to the module's rules, and
 * the room keeps whatever they make of it.
 *
 * This is the hub's whole part in playing a game, and it is deliberately small.
 * It decides exactly one thing — which player the event came from — and decides
 * nothing else: it does not know what an answer is, cannot tell a good event
 * from a bad one, and asks the module rather than judging.
 *
 * Open to every player, unlike the lifecycle above. A game only the Host could
 * act in would not be a party game.
 */
export const sendEvent = mutation({
  args: { sessionToken: v.string(), event: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { player, room } = await seatThisPhoneHolds(ctx, args.sessionToken);

    // A thumb that landed just after the Host ended the game, or a phone that
    // has not heard yet. There is nothing to tell the person holding it — the
    // screen they tapped has already gone — so this is silence, not a refusal.
    if (room.game === undefined) {
      return null;
    }

    // A room playing a game this build does not install: possible only across a
    // deployment, and not something a phone can be told anything useful about.
    const game = gameLogicById(room.game.gameId);

    if (game === undefined) {
      return null;
    }

    // The player is named here and nowhere else. A phone may put whatever it
    // likes in the event — this overwrites it with the seat the Session Token
    // holds, so naming somebody else is a claim the hub simply does not read
    // (see `GameEvent`, which calls the field a claim rather than an identity).
    const next = game.reduce(room.game.state, {
      ...(args.event as object),
      playerId: player._id,
    });

    // A module that does not recognise an event returns no state at all, and an
    // exhaustive switch over its own events is how it does that. Storing
    // `undefined` here would let one unrecognised event erase the game the room
    // is playing, so nothing arriving from a phone is ever stored unexamined.
    if (next === undefined) {
      return null;
    }

    // The rules refuse by returning the state they were given, so an identical
    // state means nothing happened — and writing it anyway would wake every
    // subscription in the room to redraw what they are already showing.
    if (next === room.game.state) {
      return null;
    }

    await ctx.db.patch(room._id, { game: { gameId: room.game.gameId, state: next } });
    return null;
  },
});

/**
 * Which card the room is browsing — the subscription the TV's carousel and the
 * non-Host phones follow.
 *
 * Always a number this build can use, so no client has to decide what an absent
 * or out-of-range index means; they would each have to decide it the same way,
 * and one of them eventually would not.
 */
export const browsing = query({
  args: { roomId: v.id('rooms') },
  returns: v.number(),
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);

    return browsingIndex(room?.browsingGameIndex);
  },
});

/**
 * What the room is playing, if anything — the subscription both clients follow
 * out of the lobby and back.
 *
 * It is a query of its own rather than a field on the roster because the two
 * change on completely different beats: a roster redraws when somebody joins,
 * goes away or claims a color, and this changes twice a game. A phone answering
 * a question would otherwise re-render on every heartbeat in the room.
 *
 * `null` is the lobby. The clients get the game's state opaque and hand it
 * straight to the module's screen, exactly as the server stored it.
 */
export const running = query({
  args: { roomId: v.id('rooms') },
  returns: v.union(v.null(), v.object({ gameId: v.string(), state: v.any() })),
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);

    return room?.game ?? null;
  },
});
