import type { GameEvent } from '@huddle/domain';
import { v } from 'convex/values';

import type { Doc } from './_generated/dataModel';
import {
  internalMutation,
  mutation,
  type MutationCtx,
  query,
} from './_generated/server';
import {
  requirePlayerSession,
  requireRoomHost,
  roomViewer,
  roomViewerArgs,
} from './lib/authorization';
import {
  clockRemainingMs,
  resumePausedGameClock,
  stopGameClock,
  windGameClock,
} from './lib/gameClock';
import {
  decodeStoredRuntime,
  projectRuntime,
  runtimeFailure,
  validatedDeadline,
} from './lib/gameRuntime';
import { cancelCountdownJob } from './lib/countdown';
import { awayPlayerIds } from './lib/presence';
import { limitGameEvent, limitHostCommand } from './lib/rateLimits';
import { setupModeValidator } from './gameSetup';

/**
 * Puts an event to the running game's rules, keeps whatever they make of it,
 * and winds the room's clock to the beat that leaves it on.
 *
 * Both ways an event reaches a game come through here — a phone's tap
 * (`sendEvent`) and the room's own clock (`reachDeadline`) — because every rule
 * below is true of both. Which is also the point: a countdown expiring is an
 * ordinary game event that happens to have no player behind it, judged by the
 * same reducer and refused in the same way.
 */
async function playGameEvent(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  event: GameEvent,
): Promise<void> {
  const running = room.game;

  // Recovery owns the pause boundary. A scheduled callback racing either
  // silence marker must not advance state after the room became unavailable.
  if (room.tvAway === true || running?.playerPaused === true) return;

  // A thumb that landed just after the Host ended the game, or a phone that has
  // not heard yet. There is nothing to tell the person holding it — the screen
  // they tapped has already gone — so this is silence, not a refusal.
  if (running === undefined) {
    return;
  }

  const runtime = decodeStoredRuntime(room._id, running);
  if (runtime === undefined) return;
  const { game, state } = runtime;

  // The clock and the room's away seats are read here and nowhere else, and
  // both are written over whatever the event arrived with — a phone claiming to
  // have answered faster than it did, or claiming somebody else has gone quiet,
  // is a claim, exactly as a phone naming a player is (see `GameEvent`).
  let decodedEvent: GameEvent;
  try {
    decodedEvent = game.decodeEvent({
      ...event,
      msRemaining: clockRemainingMs(running, Date.now()),
      awayPlayerIds: await awayPlayerIds(ctx, room._id),
      fromHost: event.playerId !== undefined && event.playerId === room.hostPlayerId,
    });
    if (decodedEvent === undefined) throw new Error('event decoder returned undefined');
  } catch {
    runtimeFailure(room._id, running, 'eventDecode');
    return;
  }

  let next: unknown;
  try {
    next = game.reduce(state, decodedEvent);
  } catch {
    runtimeFailure(room._id, running, 'reducer');
    return;
  }

  // A module that does not recognise an event returns no state at all, and an
  // exhaustive switch over its own events is how it does that. Storing
  // `undefined` here would let one unrecognised event erase the game the room
  // is playing, so nothing arriving from a phone is ever stored unexamined.
  if (next === undefined) {
    return;
  }

  // Rules refuse by returning the decoded state they were given. Check that
  // identity before decoding the result again: Zod decoders return a fresh
  // object, so comparing the twice-decoded result with the database value would
  // turn every refusal into a write and could wind a clock for a stale event.
  if (next === state) {
    return;
  }

  try {
    next = game.decodeState(next);
    if (next === undefined) throw new Error('reducer decoder returned undefined');
  } catch {
    runtimeFailure(room._id, running, 'reducerOutput');
    return;
  }

  // A beat the room was already on keeps the clock it started with: answering a
  // question does not buy the room another twenty seconds to answer it in.
  //
  // Unless it has none pending, which is a beat whose clock is stopped while the
  // module still asks for one. Two things reach that: a module whose deadline
  // event moves the state *without* leaving the beat — a tick, which
  // `reachDeadline` hands on with the fired deadline dropped — and a room that
  // was dealt its beat by a deployment older than this field. Keeping
  // `undefined` in either case stops the clock for good, and in silence, since
  // a beat that never expires throws nothing and fails no test.
  const currentDeadline = validatedDeadline(room._id, running, game, state);
  const nextDeadline = validatedDeadline(room._id, running, game, next);
  if (!currentDeadline.ok || !nextDeadline.ok) return;

  const sameBeat = currentDeadline.deadline?.beat === nextDeadline.deadline?.beat;
  const clock =
    sameBeat && running.deadline !== undefined
      ? { deadline: running.deadline, deadlineAt: running.deadlineAt }
      : await windGameClock(ctx, room, running, game, next, nextDeadline.deadline);

  if (clock === undefined) return;

  await ctx.db.patch(room._id, {
    game: {
      ...running,
      gameId: running.gameId,
      stateVersion: game.stateVersion,
      state: next,
      ...clock,
      pausedRemainingMs: undefined,
    },
  });
}

/**
 * The Host ends the game: the room returns to its lobby, and nothing else about
 * it changes.
 *
 * The roster, the host and the Room Code are untouched on purpose — this is the
 * party deciding to play something else, not the party ending. The running
 * game, draft and shared browse index are cleared together, so no stale game
 * surface can be restored when the lobby redraws.
 *
 * The shared browse index is cleared with the game draft so the next lobby
 * starts at the first card rather than reopening the card that was selected
 * for the game that just ended. A second tap is not refused; `phaseAfter`
 * explains why.
 */
export const endGame = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await limitHostCommand(ctx, args.sessionToken);
    const { room } = await requireRoomHost(ctx, args.sessionToken);

    // The game's clock stops with the game. A deadline left pending would fire
    // into whatever the room did next, and a Host who starts the same game
    // again inside its countdown would watch its first question reveal itself
    // seconds after the room was dealt it.
    await stopGameClock(ctx, room);
    await cancelCountdownJob(ctx, room.setup);
    // Unconditional: ending has no refusal to check (see `refusalToStart`), so
    // there is nothing between the Host check and the patch. `undefined` is how
    // Convex unsets an optional field. Clear all game-owned surfaces in one
    // patch: the absent game is the lobby phase, while the absent setup and
    // browse index prevent either client from reopening stale game state.
    await ctx.db.patch(room._id, {
      game: undefined,
      setup: undefined,
      browsingGameIndex: undefined,
    });
    return null;
  },
});

/** Resume after confirmed player loss when the current Host chooses to continue. */
export const continueAfterDisconnect = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await limitHostCommand(ctx, args.sessionToken);
    const { room } = await requireRoomHost(ctx, args.sessionToken);
    const running = room.game;

    // Idempotent for a duplicate tap or a choice that arrived after everybody
    // reconnected and the room already resumed itself.
    if (running?.playerPaused !== true) return null;

    const continuing = { ...running, playerPaused: undefined };

    // A TV pause has display precedence. Remember the Host's choice now, but
    // leave its stopped clock for TV recovery to re-arm later.
    if (room.tvAway === true) {
      await ctx.db.patch(room._id, { game: continuing });
      return null;
    }

    await ctx.db.patch(room._id, {
      game: await resumePausedGameClock(ctx, room, continuing, Date.now()),
    });
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
    await limitGameEvent(ctx, args.sessionToken);
    const { player, room } = await requirePlayerSession(ctx, args.sessionToken);

    // Neither recovery boundary accepts input. `playGameEvent` repeats this
    // guard because scheduled deadlines reach it without coming through here.
    if (room.tvAway === true || room.game?.playerPaused === true) return null;

    // The player is named here and nowhere else. A phone may put whatever it
    // likes in the event — this overwrites it with the seat the Session Token
    // holds, so naming somebody else is a claim the hub simply does not read
    // (see `GameEvent`, which calls the field a claim rather than an identity).
    // Writing it on every event is also what keeps an *absent* player honest:
    // no phone can produce one, so it always means the room itself.
    await playGameEvent(ctx, room, { ...(args.event as object), playerId: player._id });
    return null;
  },
});

/**
 * The room's clock running out on the beat it was watching.
 *
 * Internal, because it is the room talking to itself, exactly as `markAway` is:
 * a deadline reached is not something any phone gets to declare. What it
 * carries is the module's own event, addressed to the beat that armed it, so a
 * deadline that fires onto a beat the room has already left is refused by the
 * rules and writes nothing — which is how a question that ends either at expiry
 * or on its last answer, whichever comes first, needs no coordination between
 * the two.
 *
 * The game id is checked as well as the room: a deadline belongs to the game
 * that armed it, and a room that has moved on to another is not the room that
 * scheduled this.
 */
export const reachDeadline = internalMutation({
  args: { roomId: v.id('rooms'), gameId: v.string(), event: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    const running = room?.game;

    // The room expired, returned to its lobby, or is playing something else.
    if (room === null || running === undefined || running.gameId !== args.gameId) {
      return null;
    }

    // The deadline reaching the room is by definition no longer pending: it is
    // this mutation. So the room is handed on without it, and the beat this
    // event starts winds a fresh clock instead of trying to cancel the one it
    // is running inside. Without a due time either — a clock that has run out
    // has nothing left on it, and that is what the rules should be told.
    await playGameEvent(
      ctx,
      { ...room, game: { ...running, deadline: undefined, deadlineAt: undefined } },
      args.event as GameEvent,
    );
    return null;
  },
});

/**
 * What the room is playing, if anything — the subscription both clients follow
 * out of the lobby and back.
 *
 * It is a query of its own rather than a field on the roster because the two
 * change on completely different beats: a roster redraws when somebody joins,
 * leaves or goes away, and this changes twice a game. A phone answering
 * a question would otherwise re-render on every heartbeat in the room — see
 * `roomViewer` for the half of that this now gives back.
 *
 * `null` is the lobby. The clients get the game's state opaque and hand it
 * straight to the module's screen — as the module projects it for whoever is
 * asking (`redactStateFor`), which for a game with nothing to hide is exactly as
 * the server stored it. And nothing else the room keeps beside it: the pending
 * deadline is the room's own bookkeeping with its scheduler, and a screen
 * reading it would be counting down against a clock it has no way to compare
 * with (see `Countdown` in trivia's TV screen, which counts its own seconds for
 * that reason).
 */
export const running = query({
  args: { roomId: v.id('rooms'), ...roomViewerArgs },
  returns: v.union(
    v.null(),
    v.object({
      kind: v.literal('running'),
      gameId: v.string(),
      state: v.any(),
      settings: v.optional(v.record(v.string(), v.string())),
      mode: v.optional(setupModeValidator),
      clockRemainingMs: v.optional(v.number()),
    }),
    v.object({
      kind: v.literal('paused'),
      gameId: v.string(),
      reason: v.union(v.literal('tvDisconnected'), v.literal('playerDisconnected')),
    }),
    v.object({ kind: v.literal('unavailable'), gameId: v.string() }),
  ),
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);

    if (room?.game === undefined) {
      return null;
    }

    const running = room.game;
    // Only this room's TV and seated players see a game. The TV view is the
    // room's shared screen, so a caller proving neither gets nothing to draw.
    const viewer = await roomViewer(ctx, args.roomId, args);
    if (viewer === undefined) {
      return { kind: 'unavailable' as const, gameId: running.gameId };
    }

    const runtime = decodeStoredRuntime(args.roomId, running);
    if (runtime === undefined) {
      return { kind: 'unavailable' as const, gameId: running.gameId };
    }

    if (room.tvAway === true) {
      return {
        kind: 'paused' as const,
        gameId: running.gameId,
        reason: 'tvDisconnected' as const,
      };
    }

    if (running.playerPaused === true) {
      return {
        kind: 'paused' as const,
        gameId: running.gameId,
        reason: 'playerDisconnected' as const,
      };
    }

    const state = projectRuntime(runtime, viewer.kind === 'tv' ? undefined : viewer.playerId);
    if (state === undefined) {
      runtimeFailure(args.roomId, running, 'projection');
      return { kind: 'unavailable' as const, gameId: running.gameId };
    }

    const clockRemainingMs =
      running.deadlineAt === undefined
        ? undefined
        : Math.max(0, running.deadlineAt - Date.now());

    return {
      kind: 'running' as const,
      gameId: running.gameId,
      state,
      ...(running.settings === undefined ? {} : { settings: running.settings }),
      ...(running.mode === undefined ? {} : { mode: running.mode }),
      ...(clockRemainingMs === undefined ? {} : { clockRemainingMs }),
    };
  },
});
