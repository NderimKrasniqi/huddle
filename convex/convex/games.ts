import {
  refusalToStart,
  roomPhase,
  settingsFrom,
  settingsRefusal,
  type GameEvent,
  type GameLifecycleRejection,
  type GameLogic,
  type GamePlayer,
} from '@huddle/game-core';
import { browsingIndex, gameLogicById } from '@huddle/game-registry/logic';
import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, mutation, type MutationCtx, query } from './_generated/server';

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
 * Which beat of a running game has a clock on it, as the module names it — or
 * `undefined` where the beat has none.
 *
 * The one thing the hub can read about a game's state, and it reads it only to
 * compare: two states on the same beat are one countdown, so the room arms it
 * when it *enters* that beat and not again. Without that, a question would gain
 * another twenty seconds every time somebody pressed a button on it.
 */
function timedBeat(game: GameLogic, state: unknown): string | undefined {
  return game.deadline?.(state)?.beat;
}

/**
 * Stops whatever clock the room had running.
 *
 * A deadline that has already fired is past cancelling, and Convex says so by
 * doing nothing.
 */
async function stopGameClock(ctx: MutationCtx, room: Doc<'rooms'>): Promise<void> {
  const pending = room.game?.deadline;

  if (pending !== undefined) {
    await ctx.scheduler.cancel(pending);
  }
}

/**
 * Winds the room's clock for the beat it is entering: stops the last beat's,
 * and schedules this beat's deadline if the module declares one.
 *
 * This is the whole of how a countdown runs in a room the hub knows nothing
 * about. The module says how long to wait and what to raise
 * (`GameDeadline`), the scheduler does the waiting, and `reachDeadline` puts
 * the event back through the same rules a phone's tap goes through.
 *
 * It has to be the server's clock and not a phone's: a beat ended from a
 * Controller is a beat that stalls when every phone in the room is face-down on
 * a table, which is exactly what the reveal still does.
 */
async function windGameClock(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  game: GameLogic,
  state: unknown,
): Promise<Id<'_scheduled_functions'> | undefined> {
  await stopGameClock(ctx, room);

  const deadline = game.deadline?.(state);

  if (deadline === undefined) {
    return undefined;
  }

  return await ctx.scheduler.runAfter(deadline.afterMs, internal.games.reachDeadline, {
    roomId: room._id,
    gameId: game.metadata.id,
    event: deadline.event,
  });
}

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

  // A thumb that landed just after the Host ended the game, or a phone that has
  // not heard yet. There is nothing to tell the person holding it — the screen
  // they tapped has already gone — so this is silence, not a refusal.
  if (running === undefined) {
    return;
  }

  // A room playing a game this build does not install: possible only across a
  // deployment, and not something a phone can be told anything useful about.
  const game = gameLogicById(running.gameId);

  if (game === undefined) {
    return;
  }

  const next = game.reduce(running.state, event);

  // A module that does not recognise an event returns no state at all, and an
  // exhaustive switch over its own events is how it does that. Storing
  // `undefined` here would let one unrecognised event erase the game the room
  // is playing, so nothing arriving from a phone is ever stored unexamined.
  if (next === undefined) {
    return;
  }

  // The rules refuse by returning the state they were given, so an identical
  // state means nothing happened — and writing it anyway would wake every
  // subscription in the room to redraw what they are already showing.
  if (next === running.state) {
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
  const sameBeat = timedBeat(game, next) === timedBeat(game, running.state);
  const deadline =
    sameBeat && running.deadline !== undefined
      ? running.deadline
      : await windGameClock(ctx, room, game, next);

  await ctx.db.patch(room._id, { game: { gameId: running.gameId, state: next, deadline } });
}

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
    gameId: v.string(),
    settings: v.optional(v.record(v.string(), v.string())),
  },
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
    // The room's own refusals first, then the settings': a party too small to
    // play hears that before it hears about a setting, whatever it sent.
    const refusal =
      refusalToStart(roomPhase(room.game), players.length, game.metadata.playerRange) ??
      settingsRefusal(game.settingsSchema, args.settings);

    if (refusal !== null) {
      throw new ConvexError<GameLifecycleRejection>(refusal);
    }

    const state = game.createInitialState({
      players,
      settings: settingsFrom(game.settingsSchema, args.settings),
    });
    // The first beat's clock starts with the game, so a room that has been
    // dealt a question is already being counted down at the moment every screen
    // in it draws that question.
    const deadline = await windGameClock(ctx, room, game, state);

    await ctx.db.patch(room._id, { game: { gameId: game.metadata.id, state, deadline } });

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

    // The game's clock stops with the game. A deadline left pending would fire
    // into whatever the room did next, and a Host who starts the same game
    // again inside its countdown would watch its first question reveal itself
    // seconds after the room was dealt it.
    await stopGameClock(ctx, room);
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
    // is running inside.
    await playGameEvent(
      ctx,
      { ...room, game: { ...running, deadline: undefined } },
      args.event as GameEvent,
    );
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
 * straight to the module's screen, exactly as the server stored it — and
 * nothing else the room keeps beside it: the pending deadline is the room's own
 * bookkeeping with its scheduler, and a screen reading it would be counting
 * down against a clock it has no way to compare with (see `Countdown` in
 * trivia's TV screen, which counts its own seconds for that reason).
 */
export const running = query({
  args: { roomId: v.id('rooms') },
  returns: v.union(v.null(), v.object({ gameId: v.string(), state: v.any() })),
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);

    if (room?.game === undefined) {
      return null;
    }

    return { gameId: room.game.gameId, state: room.game.state };
  },
});
