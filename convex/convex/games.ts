import {
  defaultSettings,
  phaseAfter,
  roomPhase,
  type GameLifecycleRejection,
  type GamePlayer,
} from '@huddle/game-core';
import { gameLogicById } from '@huddle/game-registry/logic';
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
async function roomThisPhoneRuns(
  ctx: MutationCtx,
  sessionToken: string,
): Promise<Doc<'rooms'>> {
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

    const transition = phaseAfter(roomPhase(room.game), 'start');

    if ('refused' in transition) {
      throw new ConvexError<GameLifecycleRejection>(transition.refused);
    }

    const players = await playersFor(ctx, room._id);

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
    const transition = phaseAfter(roomPhase(room.game), 'end');

    // `phaseAfter` never refuses an end; the branch is here so that a rule
    // added to it later cannot be silently ignored at this call site.
    if ('refused' in transition) {
      throw new ConvexError<GameLifecycleRejection>(transition.refused);
    }

    // `undefined` is how Convex unsets an optional field, which is the whole of
    // returning to the lobby.
    await ctx.db.patch(room._id, { game: undefined });
    return null;
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
