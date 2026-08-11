import {
  refusalToStart,
  roomPhase,
  settingsFrom,
  settingsRefusal,
  settingsRefusalForMode,
  type GameSetupMode,
  type GameEvent,
  type GameLifecycleRejection,
  type GamePlayerId,
} from '@huddle/game-core';
import { browsingIndex, gameLogicById, GAME_LOGIC_REGISTRY } from '@huddle/game-registry/logic';
import { ConvexError, v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import {
  internalMutation,
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from './_generated/server';
import {
  playerForSession,
  requirePlayerSession,
  requireRoomHost,
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
import { awayPlayerIds, gamePlayersInRoom } from './lib/presence';

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
 * each module answers what its state begins as, so the installed list can grow
 * without changing the hub.
 */

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

const setupModeValidator = v.union(
  v.literal('quick'),
  v.literal('standard'),
  v.literal('custom'),
);

/** Shared Host draft projection used by the phone and TV setup surfaces. */
export const setup = query({
  args: { roomId: v.id('rooms') },
  returns: v.union(
    v.null(),
    v.object({
      gameId: v.string(),
      settings: v.record(v.string(), v.string()),
      mode: setupModeValidator,
    }),
  ),
  handler: async (ctx, args) => (await ctx.db.get(args.roomId))?.setup ?? null,
});

function setupForGame(gameId: string, mode: GameSetupMode | undefined, chosen: Record<string, string> | undefined) {
  const game = gameLogicById(gameId);
  if (game === undefined) {
    throw new ConvexError<GameLifecycleRejection>({ kind: 'gameNotInstalled', gameId });
  }
  const preset =
    mode === undefined || mode === 'custom'
      ? undefined
      : game.settingsPresentation?.presets?.find((candidate) => candidate.mode === mode)?.settings;
  const settings = chosen ?? preset ?? settingsFrom(game.settingsSchema, undefined);
  const resolvedMode = mode ?? 'standard';
  const refusal = settingsRefusalForMode(
    game.settingsSchema,
    game.settingsPresentation,
    settings,
    resolvedMode,
  );
  if (refusal !== null) throw new ConvexError<GameLifecycleRejection>(refusal);
  return { game, settings, mode: resolvedMode };
}

/** Select a game and seed a standard draft without starting it. */
export const selectGame = mutation({
  args: { sessionToken: v.string(), gameId: v.string(), mode: v.optional(setupModeValidator) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { room } = await requireRoomHost(ctx, args.sessionToken);
    if (room.game !== undefined) throw new ConvexError({ kind: 'setupAlreadyRunning' });
    const selected = setupForGame(args.gameId, args.mode, undefined);
    const index = GAME_LOGIC_REGISTRY.findIndex((entry) => entry.metadata.id === args.gameId);
    await ctx.db.patch(room._id, {
      setup: { gameId: args.gameId, settings: selected.settings, mode: selected.mode },
      ...(index < 0 ? {} : { browsingGameIndex: browsingIndex(index) }),
    });
    return null;
  },
});

/** Apply a partial or complete settings draft while the room is configuring. */
export const configureGame = mutation({
  args: {
    sessionToken: v.string(),
    gameId: v.optional(v.string()),
    settings: v.record(v.string(), v.string()),
    mode: v.optional(setupModeValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { room } = await requireRoomHost(ctx, args.sessionToken);
    if (room.game !== undefined) throw new ConvexError({ kind: 'setupAlreadyRunning' });
    const gameId = args.gameId ?? room.setup?.gameId;
    if (gameId === undefined) throw new ConvexError({ kind: 'setupNotFound' });
    const game = gameLogicById(gameId);
    if (game === undefined) {
      throw new ConvexError<GameLifecycleRejection>({ kind: 'gameNotInstalled', gameId });
    }
    const merged = { ...room.setup?.settings, ...args.settings };
    const mode = args.mode ?? room.setup?.mode ?? 'custom';
    const refusal = settingsRefusalForMode(
      game.settingsSchema,
      game.settingsPresentation,
      merged,
      mode,
    );
    if (refusal !== null) throw new ConvexError<GameLifecycleRejection>(refusal);
    await ctx.db.patch(room._id, {
      setup: {
        gameId,
        settings: settingsFrom(game.settingsSchema, merged),
        mode,
      },
    });
    return null;
  },
});

/** Leave the picker and clear an unfinished draft. */
export const cancelGameSetup = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { room } = await requireRoomHost(ctx, args.sessionToken);
    if (room.game === undefined) await ctx.db.patch(room._id, { setup: undefined });
    return null;
  },
});

/**
 * The Host starts a game: the room leaves its lobby holding the module's
 * opening state, and every client follows it there.
 *
 * The state is seeded here rather than on the phone that tapped, because it is
 * the room's state and not that phone's — every screen in the room reads it
 * from the same row, so there is no moment where the television and a
 * Controller disagree about what was dealt.
 *
 * The settings arrive from the Host's phone and are settled against the
 * declaring game's own schema, which the hub reads as labelled strings and
 * nothing more: anything the schema does not offer is refused, and anything the
 * Host left alone is defaulted (`settingsRefusal`, `settingsFrom`). They are
 * optional because a Host who never opened the settings screen still starts a
 * game, and that game still has settings.
 */
export const startGame = mutation({
  args: {
    sessionToken: v.string(),
    /** Optional for new clients, which start the current shared setup draft. */
    gameId: v.optional(v.string()),
    settings: v.optional(v.record(v.string(), v.string())),
    mode: v.optional(v.union(v.literal('quick'), v.literal('standard'), v.literal('custom'))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { room } = await requireRoomHost(ctx, args.sessionToken);

    if (room.tvAway === true) {
      throw new ConvexError({ kind: 'tvUnavailable' });
    }

    // Whether a game exists at all is a property of what was sent, not of any
    // room — but it is asked after the Host check, so a non-Host learns only
    // that it is not the Host.
    const gameId = args.gameId ?? room.setup?.gameId;
    if (gameId === undefined) {
      throw new ConvexError({ kind: 'setupNotFound' });
    }
    const game = gameLogicById(gameId);

    if (game === undefined) {
      throw new ConvexError<GameLifecycleRejection>({
        kind: 'gameNotInstalled',
        gameId,
      });
    }

    const players = await gamePlayersInRoom(ctx, room._id);
    const requestedSettings =
      args.settings === undefined && room.setup?.settings === undefined
        ? undefined
        : { ...room.setup?.settings, ...args.settings };
    // The room's own refusals first, then the settings': a party too small to
    // play hears that before it hears about a setting, whatever it sent.
    const mode = args.mode ?? room.setup?.mode;
    const refusal =
      refusalToStart(roomPhase(room.game, room.setup), players.length, game.metadata.playerRange) ??
      (room.setup !== undefined || mode !== undefined
        ? settingsRefusalForMode(
            game.settingsSchema,
            game.settingsPresentation,
            requestedSettings,
            mode ?? 'standard',
          )
        : settingsRefusal(game.settingsSchema, requestedSettings));

    if (refusal !== null) {
      throw new ConvexError<GameLifecycleRejection>(refusal);
    }

    let state: unknown;
    try {
      state = game.decodeState(
        game.createInitialState({
          players,
          settings: settingsFrom(game.settingsSchema, requestedSettings),
        }),
      );
      if (state === undefined) throw new Error('initial state decoder returned undefined');
    } catch {
      throw new ConvexError({ kind: 'gameUnavailable', gameId: game.metadata.id });
    }
    // The first beat's clock starts with the game, so a room that has been
    // dealt a question is already being counted down at the moment every screen
    // in it draws that question.
    const clock = await windGameClock(
      ctx,
      room,
      { gameId: game.metadata.id, stateVersion: game.stateVersion, state },
      game,
      state,
    );

    if (clock === undefined) {
      throw new ConvexError({ kind: 'gameUnavailable', gameId: game.metadata.id });
    }

    await ctx.db.patch(room._id, {
      game: {
        gameId: game.metadata.id,
        stateVersion: game.stateVersion,
        state,
        settings: settingsFrom(game.settingsSchema, requestedSettings),
        mode: (args.mode ?? room.setup?.mode ?? 'standard') as GameSetupMode,
        ...clock,
      },
      setup: undefined,
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
    const { room } = await requireRoomHost(ctx, args.sessionToken);

    // The game's clock stops with the game. A deadline left pending would fire
    // into whatever the room did next, and a Host who starts the same game
    // again inside its countdown would watch its first question reveal itself
    // seconds after the room was dealt it.
    await stopGameClock(ctx, room);
    // Unconditional: ending has no refusal to check (see `refusalToStart`), so
    // there is nothing between the Host check and the patch. `undefined` is how
    // Convex unsets an optional field, which is the whole of returning to the
    // lobby — `phaseAfter('end')` is that field being absent.
    await ctx.db.patch(room._id, { game: undefined, setup: undefined });
    return null;
  },
});

/**
 * Replay a finished game with the current roster and immutable locked settings.
 * No state, question index, answers, or standings are carried into the new run.
 */
export const replayGame = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { room } = await requireRoomHost(ctx, args.sessionToken);
    if (room.tvAway === true) throw new ConvexError({ kind: 'tvUnavailable' });
    const running = room.game;
    if (running === undefined) throw new ConvexError({ kind: 'replayNotFinished' });
    const game = gameLogicById(running.gameId);
    if (game === undefined) {
      throw new ConvexError<GameLifecycleRejection>({ kind: 'gameNotInstalled', gameId: running.gameId });
    }
    const players = await gamePlayersInRoom(ctx, room._id);
    if (
      players.length < game.metadata.playerRange.min ||
      players.length > game.metadata.playerRange.max
    ) {
      throw new ConvexError({ kind: 'replayNotAllowed' });
    }
    let state: unknown;
    try {
      const decoded = game.decodeState(running.state);
      if (game.isFinished !== undefined && !game.isFinished(decoded)) {
        throw new Error('not finished');
      }
      if (game.isFinished === undefined) throw new Error('no finished predicate');
      const settings = settingsFrom(game.settingsSchema, running.settings);
      state = game.decodeState(game.createInitialState({ players, settings }));
      if (state === undefined) throw new Error('initial state decoder returned undefined');
      const clock = await windGameClock(
        ctx,
        room,
        { gameId: game.metadata.id, stateVersion: game.stateVersion, state },
        game,
        state,
      );
      if (clock === undefined) throw new Error('clock unavailable');
      await ctx.db.patch(room._id, {
        game: {
          gameId: game.metadata.id,
          stateVersion: game.stateVersion,
          state,
          settings,
          mode: running.mode ?? 'standard',
          ...clock,
        },
        setup: undefined,
      });
    } catch {
      throw new ConvexError({ kind: 'replayNotFinished' });
    }
    return null;
  },
});

/** Resume after confirmed player loss when the current Host chooses to continue. */
export const continueAfterDisconnect = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
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
 * also allowed mid-game and while the TV is away — the carousel is lobby
 * furniture, and retaining the Host's draft lets the TV resume on the same
 * selection when it reconnects.
 */
export const browseGame = mutation({
  args: { sessionToken: v.string(), index: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { room } = await requireRoomHost(ctx, args.sessionToken);

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
 * Which card the room is browsing — the subscription the TV's carousel and the
 * non-Host phones follow — or `null` if nobody has browsed in it yet.
 *
 * An index this build can use whenever there is one, so no client has to decide
 * what an *out-of-range* index means; they would each have to decide it the
 * same way, and one of them eventually would not.
 *
 * "Nobody has browsed yet" is the one thing this does not flatten, because it
 * is not the same question. It used to: an unbrowsed room reported card zero,
 * which is the right card to draw and the wrong answer to "has the Host started
 * picking a game", and the television now asks the second one. Its Room screen
 * — code, QR and roster together — stands until the Host takes over the
 * carousel, so a room reporting a card it had never been browsed to would put
 * the game cards up over a room code nobody had finished reading.
 *
 * Every client that only wants a card still writes `?? 0` and is exactly where
 * it was.
 */
export const browsing = query({
  args: { roomId: v.id('rooms') },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);

    return room?.browsingGameIndex === undefined
      ? null
      : browsingIndex(room.browsingGameIndex);
  },
});

/**
 * The player this phone holds in `roomId`, from the Session Token it presents —
 * or `undefined` for the television, and for a phone whose token names a seat in
 * another room.
 *
 * The viewer a game's state is redacted for, resolved from the token here for
 * the same reason an event's player is: a phone naming itself is a claim, so the
 * seat is looked up and never taken on the client's word (see `GameEvent`). A
 * token for some other room's seat is nobody here — it is handed the same view
 * the television gets, which is the one that keeps every player's private state.
 *
 * The cost, written down so it is not rediscovered: this puts the asking phone's
 * own `players` row in the read set of its `running` subscription, and
 * `heartbeat` patches that row every few seconds. So a phone's own beat now
 * re-runs its own `running` — which is exactly what the query below was split
 * off to avoid, though only for the phone's own beat rather than for every beat
 * in the room. The alternative is taking the viewer from a client-supplied
 * player id, which is the claim this whole lookup exists to refuse.
 */
async function viewerIn(
  ctx: QueryCtx,
  roomId: Id<'rooms'>,
  sessionToken: string | undefined,
): Promise<GamePlayerId | undefined> {
  if (sessionToken === undefined) {
    return undefined;
  }

  const player = await playerForSession(ctx, sessionToken);

  return player !== null && player.roomId === roomId ? player._id : undefined;
}

/**
 * What the room is playing, if anything — the subscription both clients follow
 * out of the lobby and back.
 *
 * It is a query of its own rather than a field on the roster because the two
 * change on completely different beats: a roster redraws when somebody joins,
 * leaves or goes away, and this changes twice a game. A phone answering
 * a question would otherwise re-render on every heartbeat in the room — see
 * `viewerIn` for the half of that this now gives back.
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
  args: { roomId: v.id('rooms'), sessionToken: v.optional(v.string()) },
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

    const viewer = await viewerIn(ctx, args.roomId, args.sessionToken);
    const state = projectRuntime(runtime, viewer);
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
