import {
  refusalToStart,
  roomPhase,
  settingsFrom,
  settingsRefusal,
  settingsRefusalForMode,
  type GameSetupMode,
  type GameLifecycleRejection,
} from '@huddle/domain';
import { browsingIndex, gameLogicById, GAME_LOGIC_REGISTRY } from '@huddle/game-registry/logic';
import { ConvexError, v } from 'convex/values';

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
import { windGameClock } from './lib/gameClock';
import {
  beginCountdown,
  cancelCountdownJob,
  readyCheckComplete,
  reconcileCountdown,
  withoutCountdown,
} from './lib/countdown';
import { gamePlayersInRoom } from './lib/presence';
import { limitHostCommand, limitMemberCommand } from './lib/rateLimits';

export const setupModeValidator = v.union(
  v.literal('quick'),
  v.literal('standard'),
  v.literal('custom'),
);

/** Shared Host draft projection used by the phone and TV setup surfaces. */
export const setup = query({
  args: { roomId: v.id('rooms'), ...roomViewerArgs },
  returns: v.union(
    v.null(),
    v.object({
      gameId: v.string(),
      settings: v.record(v.string(), v.string()),
      mode: setupModeValidator,
      stage: v.union(v.literal('configuring'), v.literal('ready'), v.literal('countdown')),
      readyPlayerIds: v.array(v.id('players')),
      /**
       * When the countdown's start is due, in server epoch milliseconds. An
       * absolute time rather than a remainder, because a query must not read
       * the clock: a cached answer would hand a late subscriber a stale
       * remainder. Clients count down against their own clock.
       */
      countdownEndsAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    if ((await roomViewer(ctx, args.roomId, args)) === undefined) return null;
    const draft = (await ctx.db.get(args.roomId))?.setup;
    if (draft === undefined) return null;
    const stage = draft.stage ?? 'configuring';
    return {
      gameId: draft.gameId,
      settings: draft.settings,
      mode: draft.mode,
      stage,
      readyPlayerIds: draft.readyPlayerIds ?? [],
      ...(stage === 'countdown' && draft.countdownEndsAt !== undefined
        ? { countdownEndsAt: draft.countdownEndsAt }
        : {}),
    };
  },
});

function setupForGame(gameId: string, mode: GameSetupMode | undefined, chosen: Record<string, string> | undefined) {
  const game = gameLogicById(gameId);
  if (game === undefined) {
    throw new ConvexError<GameLifecycleRejection>({ kind: 'gameNotInstalled', gameId });
  }
  const resolvedMode = mode ?? 'standard';
  const preset =
    resolvedMode === 'custom'
      ? undefined
      : game.settingsPresentation?.presets?.find((candidate) => candidate.mode === resolvedMode)?.settings;
  const settings = chosen ?? preset ?? settingsFrom(game.settingsSchema, undefined);
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
    await limitHostCommand(ctx, args.sessionToken);
    const { room } = await requireRoomHost(ctx, args.sessionToken);
    if (room.game !== undefined) throw new ConvexError({ kind: 'setupAlreadyRunning' });
    const selected = setupForGame(args.gameId, args.mode, undefined);
    const index = GAME_LOGIC_REGISTRY.findIndex((entry) => entry.metadata.id === args.gameId);
    await ctx.db.patch(room._id, {
      setup: { gameId: args.gameId, settings: selected.settings, mode: selected.mode, stage: 'configuring', readyPlayerIds: [] },
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
    await limitHostCommand(ctx, args.sessionToken);
    const { room } = await requireRoomHost(ctx, args.sessionToken);
    if (room.game !== undefined) throw new ConvexError({ kind: 'setupAlreadyRunning' });
    const gameId = args.gameId ?? room.setup?.gameId;
    if (gameId === undefined) throw new ConvexError({ kind: 'setupNotFound' });
    if (room.setup?.stage === 'ready' || room.setup?.stage === 'countdown') {
      throw new ConvexError({ kind: 'setupLocked' });
    }
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
        stage: 'configuring',
        readyPlayerIds: [],
      },
    });
    return null;
  },
});

/**
 * Host validates and locks the shared setup, which starts the ready check.
 *
 * Starting the ready check is the Host saying they are ready, so the Host's
 * seat starts Ready and everybody else starts waiting.
 */
export const finalizeGameSetup = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await limitHostCommand(ctx, args.sessionToken);
    const { player, room } = await requireRoomHost(ctx, args.sessionToken);
    const draft = room.setup;
    if (draft === undefined) throw new ConvexError({ kind: 'setupNotFound' });
    setupForGame(draft.gameId, draft.mode, draft.settings);
    await cancelCountdownJob(ctx, draft);
    await ctx.db.patch(room._id, {
      setup: { ...withoutCountdown(draft), stage: 'ready', readyPlayerIds: [player._id] },
    });
    return null;
  },
});

/** Each authenticated member controls only their own Ready flag. */
export const setGameReady = mutation({
  args: { sessionToken: v.string(), ready: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await limitMemberCommand(ctx, args.sessionToken);
    const { player, room } = await requirePlayerSession(ctx, args.sessionToken);
    const draft = room.setup;
    if (draft === undefined) throw new ConvexError({ kind: 'setupNotFound' });
    if (draft.stage !== 'ready' && draft.stage !== 'countdown') {
      throw new ConvexError({ kind: 'setupNotReady' });
    }
    const current = draft.readyPlayerIds ?? [];
    const readyPlayerIds = args.ready
      ? current.includes(player._id) ? current : [...current, player._id]
      : current.filter((playerId) => playerId !== player._id);
    await ctx.db.patch(room._id, { setup: { ...draft, readyPlayerIds } });
    // An un-Ready during the countdown stops it.
    await reconcileCountdown(ctx, room._id);
    return null;
  },
});

/** Host reopens editing and clears the entire party's readiness. */
export const reopenGameSetup = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await limitHostCommand(ctx, args.sessionToken);
    const { room } = await requireRoomHost(ctx, args.sessionToken);
    const draft = room.setup;
    if (draft === undefined) throw new ConvexError({ kind: 'setupNotFound' });
    await cancelCountdownJob(ctx, draft);
    await ctx.db.patch(room._id, {
      setup: { ...withoutCountdown(draft), stage: 'configuring', readyPlayerIds: [] },
    });
    return null;
  },
});

/** Return the whole room to its lobby and clear any unfinished game draft. */
export const cancelGameSetup = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await limitHostCommand(ctx, args.sessionToken);
    const { room } = await requireRoomHost(ctx, args.sessionToken);
    if (room.game === undefined) {
      await cancelCountdownJob(ctx, room.setup);
      await ctx.db.patch(room._id, {
        setup: undefined,
        browsingGameIndex: undefined,
      });
    }
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
 * Phone disagree about what was dealt.
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
    await limitHostCommand(ctx, args.sessionToken);
    const { room } = await requireRoomHost(ctx, args.sessionToken);
    // A Host starting during the countdown skips the rest of it.
    await startFromSetup(ctx, room, args);
    return null;
  },
});

/**
 * The Host's Start: once everybody is Ready, the room counts down and then
 * starts the game (`launchCountdown`). Refused exactly as a start would be, so
 * the countdown only begins on a room that could start right now. A second tap
 * during the countdown is not refused; the room is already doing what it asks.
 */
export const startCountdown = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await limitHostCommand(ctx, args.sessionToken);
    const { room } = await requireRoomHost(ctx, args.sessionToken);
    if (room.setup?.stage === 'countdown') return null;
    await validatedStart(ctx, room, {});
    await beginCountdown(ctx, room);
    return null;
  },
});

/** The Host stops the countdown; the room goes back to its ready check. */
export const stopCountdown = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await limitHostCommand(ctx, args.sessionToken);
    const { room } = await requireRoomHost(ctx, args.sessionToken);
    const setup = room.setup;
    if (setup?.stage !== 'countdown') return null;
    await cancelCountdownJob(ctx, setup);
    await ctx.db.patch(room._id, { setup: withoutCountdown(setup) });
    return null;
  },
});

/**
 * The countdown running out: the room starts the game it has been counting
 * down to, as long as the ready check still holds.
 *
 * `endsAt` names the countdown this call was scheduled for. A countdown that
 * was stopped, restarted or skipped by the Host has a different one (or none),
 * and this call then does nothing.
 */
export const launchCountdown = internalMutation({
  args: { roomId: v.id('rooms'), endsAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    const setup = room?.setup;
    if (room === null || setup === undefined) return null;
    if (setup.stage !== 'countdown' || setup.countdownEndsAt !== args.endsAt) return null;

    // This call is the scheduled job, so it must not cancel itself: a running
    // function that is cancelled also loses what it schedules, which would
    // include the game's first clock.
    const settled = { ...room, setup: { ...setup, countdownJob: undefined } };
    if (!(await readyCheckComplete(ctx, settled))) {
      await ctx.db.patch(room._id, { setup: withoutCountdown(setup) });
      return null;
    }

    try {
      await startFromSetup(ctx, settled, {});
    } catch (error) {
      // The start was refused after all (a setting no longer valid, a module
      // that failed to deal). Nobody is waiting on this call to hear why, so
      // the room goes back to its ready check where the Host can act.
      if (!(error instanceof ConvexError)) throw error;
      await ctx.db.patch(room._id, { setup: withoutCountdown(setup) });
    }
    return null;
  },
});

/**
 * Starts the room's game from its locked setup, or throws the refusal.
 *
 * Shared by the Host's `startGame` and the countdown's `launchCountdown`, so
 * both starts are judged by the same rules.
 */
/** A new game's seed: every start, including a replay, deals afresh. */
function freshSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

async function startFromSetup(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  args: StartArgs,
): Promise<void> {
  const { game, players, requestedSettings } = await validatedStart(ctx, room, args);

  let state: unknown;
  try {
    state = game.decodeState(
      game.createInitialState({
        players,
        settings: settingsFrom(game.settingsSchema, requestedSettings),
        seed: freshSeed(),
      }),
    );
    if (state === undefined) throw new Error('initial state decoder returned undefined');
  } catch {
    throw new ConvexError({ kind: 'gameUnavailable', gameId: game.metadata.id });
  }

  // Past every refusal, so a refused start leaves the countdown running.
  await cancelCountdownJob(ctx, room.setup);

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
}

type StartArgs = {
  readonly gameId?: string;
  readonly settings?: Record<string, string>;
  readonly mode?: GameSetupMode;
};

/**
 * Every refusal a start can meet, in the order the room hears them, or the
 * game, seats and settings the start would use. Shared by the Host's Start
 * (which begins the countdown) and the start itself, so a countdown only ever
 * begins on a room that could start right now.
 */
async function validatedStart(ctx: MutationCtx, room: Doc<'rooms'>, args: StartArgs) {
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
  if (room.setup?.stage !== 'ready' && room.setup?.stage !== 'countdown') {
    throw new ConvexError({ kind: 'setupNotReady' });
  }
  const away = players.filter((player) => player.away).map((player) => player.playerId);
  if (away.length > 0) throw new ConvexError({ kind: 'playersAway', playerIds: away });
  const ready = new Set<string>((room.setup.readyPlayerIds ?? []).map(String));
  const unready = players.filter((player) => !ready.has(player.playerId)).map((player) => player.playerId);
  if (unready.length > 0) throw new ConvexError({ kind: 'playersNotReady', playerIds: unready });
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

  return { game, players, requestedSettings };
}

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
 * allowed mid-game, but while the TV is away the Host remains authorized and
 * the mutation is a deliberate no-op so the carousel can resume from its last
 * committed selection when the display reconnects.
 */
export const browseGame = mutation({
  args: { sessionToken: v.string(), index: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await limitHostCommand(ctx, args.sessionToken);
    const { room } = await requireRoomHost(ctx, args.sessionToken);

    // Browsing is a shared TV surface. A disconnected display must retain the
    // last committed card and resume it when it returns; the Host is still
    // authorized, but this mutation intentionally has no state effect.
    if (room.tvAway === true) {
      return null;
    }

    await ctx.db.patch(room._id, { browsingGameIndex: browsingIndex(args.index) });
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
  args: { roomId: v.id('rooms'), ...roomViewerArgs },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, args) => {
    if ((await roomViewer(ctx, args.roomId, args)) === undefined) return null;
    const room = await ctx.db.get(args.roomId);

    return room?.browsingGameIndex === undefined
      ? null
      : browsingIndex(room.browsingGameIndex);
  },
});
