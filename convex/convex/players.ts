import {
  AWAY_AFTER_MS,
  generateSessionToken,
  type HostControlRejection,
  isAvatarId,
  isGuestId,
  type JoinRejection,
  NICKNAME_MAX_LENGTH,
  normalizeRoomCode,
  ROOM_PLAYER_CAP,
} from '@huddle/domain';
import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, mutation, type MutationCtx, query } from './_generated/server';
import { playerForSession, requireRoomHost } from './lib/authorization';
import { pauseGameClock, resumePausedGameClock, stopGameClock } from './lib/gameClock';
import { playersInRoom } from './lib/presence';
import { deleteRoom } from './lib/roomLifecycle';
import { watchForDesertion } from './rooms';
import { avatarValidator } from './schema';
import { limitHostCommand, limitJoin, limitMemberCommand } from './lib/rateLimits';

// A join is refused with a `ConvexError` for the reason `openRoom` throws one
// (see rooms.ts): Convex redacts the message of anything else to "Server
// Error", while `data` crosses the wire intact. `JoinRejection` itself lives in
// game-core, because the Phone reads every one of these.

/**
 * A Room Code as the room holds it. The code is a token in a player's hands —
 * read off a TV across the room, typed with a stray space, or arriving from a
 * hand-written deep link — so its case and padding are the phone's accident,
 * not a different room.
 */
/**
 * Whether two nicknames are the same name. Case and surrounding spaces do not
 * count: two seats reading "Sam" and "sam" are one name to everyone looking at
 * the TV, and the rule exists for exactly those people.
 */
function sameNickname(one: string, other: string): boolean {
  return one.trim().toLowerCase() === other.trim().toLowerCase();
}

/**
 * Whether a trimmed nickname is one a room can hold: something, and not too
 * much of it.
 *
 * The server asks because it cannot assume anybody asked before it. `joinRoom`
 * is public and Huddle has no auth by design (docs/tech-stack.md), so the join
 * screen's own check is a courtesy to whoever is typing, not a promise about
 * what arrives. A nickname of nothing but spaces would seat a player the TV
 * cannot name; an unbounded one is a string every client in the room re-reads
 * on every roster update.
 *
 * Length is counted in characters rather than UTF-16 units, so a name written
 * in emoji is measured the way its owner sees it (as in `playerInitials`).
 */
function isUsableNickname(trimmedNickname: string): boolean {
  return trimmedNickname !== '' && [...trimmedNickname].length <= NICKNAME_MAX_LENGTH;
}

/**
 * Watches one player for silence: `markAway` runs `after` milliseconds from now
 * and decides then whether the room has stopped hearing from their phone.
 *
 * Exactly one of these is pending for every player who is present, and nothing
 * ever cancels one — a check that finds the player still beating re-arms itself
 * for the moment their latest beat goes stale, so the chain runs for as long as
 * they are here and ends by marking them Away. Being away is therefore the same
 * thing as having no check pending, which is why `heartbeat` starts a chain only
 * for a player who *was* away, and why `joinRoom` starts the first one.
 */
async function watchForSilence(
  ctx: MutationCtx,
  playerId: Id<'players'>,
  after: number = AWAY_AFTER_MS,
): Promise<void> {
  await ctx.scheduler.runAfter(after, internal.players.markAway, { playerId });
}

/** How long it has been since the room last heard from this player's phone. */
function silenceOf(player: Doc<'players'>): number {
  return Date.now() - player.lastSeenAt;
}

/**
 * Whether this room has nobody running it — no host named, or one whose player
 * row is gone.
 *
 * The second half became reachable with `leaveRoom`. It used to be unreachable
 * — the only thing that deleted a player was room expiry, which took the room
 * and its pointer with it — and it was asked anyway because the cost of being
 * wrong is not symmetric: a room left holding a dangling host can never be
 * started by anybody, and no join afterwards would fix it, whereas the guard is
 * one read on a mutation that happens at most ten times a room. That defensive
 * read is now load-bearing: a host who leaves a room where nobody else is still
 * beating hands it to nobody (`handOverRoom`), and this is what puts a host
 * back in it at the next join.
 */
async function needsHost(ctx: MutationCtx, room: Doc<'rooms'>): Promise<boolean> {
  return room.hostPlayerId === undefined || (await ctx.db.get(room.hostPlayerId)) === null;
}

/**
 * Hands the room to somebody else, if the player who has just gone quiet was
 * the one running it.
 *
 * The successor is the longest-connected player the room is still hearing from:
 * the `by_room` index reads in join order, so the first such row is the earliest
 * to have joined. Join order is what "longest-connected" means here — a player
 * who dropped out and came back has the seat they always had, and ranking by how
 * long the current run of heartbeats has lasted would move the room around on
 * every reconnection without telling anybody anything more useful.
 *
 * Who counts as still here is asked of `lastSeenAt` and not of the `away` flag,
 * for the same reason `markAway` asks it that way: the flag is the room's
 * *published* view of presence and lags a phone going quiet by up to a
 * scheduled check, and inside a mutation the room knows better. It matters when
 * a whole party puts its phones down at once — every check comes due at
 * roughly the same moment, and against the flag the first one to run would hand
 * the room to a player it was about to give up on, purely because that player's
 * check had not fired yet.
 *
 * A room with nobody still beating keeps the host it has. Handing it to nobody
 * would leave a room that cannot start a game once its players come back —
 * being away is not resigning, and a party backgrounding their phones between
 * rounds must not cost the room its host. The first returning heartbeat repairs
 * that temporary pointer when somebody other than the old Host comes back.
 *
 * **That last paragraph is `markAway`'s alone**, and `departingIsLeaving` is
 * what says so. It holds there because the departing row survives: the room
 * keeps a host who may yet come back, and a party backgrounding their phones
 * between rounds loses nothing. Under `leaveRoom` the row is deleted, so
 * "keeps the host it has" would degenerate into keeping nobody — a pointer at a
 * deleted row, which every host control reads as `notHost`. That is a room the
 * remaining players cannot start a game in, cannot hand over, and cannot repair
 * without somebody new joining, and it is reachable by one person having their
 * phone in a pocket for thirteen seconds.
 *
 * So a leaver hands on to the longest-connected seat left even if the room is
 * not currently hearing from it. Being away is not resigning — but it is not a
 * reason to strand everybody else either, and an away player who comes back to
 * find themselves host is exactly what `needsHost` would have produced at the
 * next join anyway.
 */
async function handOverRoom(
  ctx: MutationCtx,
  departing: Doc<'players'>,
  /**
   * Whether the departing row is about to be *deleted*, which changes what
   * "nobody is beating" is allowed to mean — see the last paragraph above.
   */
  departingIsLeaving = false,
): Promise<void> {
  const room = await ctx.db.get(departing.roomId);

  if (room === null || room.hostPlayerId !== departing._id) {
    return;
  }

  const seated = await playersInRoom(ctx, departing.roomId);
  // The departing player is excluded by id rather than by their own silence,
  // which is a number this very call was prompted by: the point is that a host
  // cannot succeed themselves, and that should not rest on arithmetic.
  const others = seated.filter((player) => player._id !== departing._id);
  const beating = others.find((player) => silenceOf(player) < AWAY_AFTER_MS);
  // A leaver's room must come away with *a* host. `beating` is still preferred
  // — a phone the room is hearing from can act on the handover now — but when
  // there is none, the longest-connected remaining seat takes it anyway rather
  // than the room keeping a pointer to a row that is about to be deleted. The
  // `by_room` index reads in join order, so `others[0]` is that seat.
  const successor = beating ?? (departingIsLeaving ? others[0] : undefined);

  if (successor === undefined) {
    return;
  }

  await ctx.db.patch(room._id, { hostPlayerId: successor._id });
}

/**
 * Give a room whose Host is still silent to its longest-connected live seat.
 *
 * This runs only when an away player returns. That is the one transition that
 * can make a room with an intentionally retained away Host actionable again,
 * and keeps the roster reads off ordinary three-second heartbeats.
 */
async function restoreConnectedHost(ctx: MutationCtx, roomId: Id<'rooms'>): Promise<void> {
  const room = await ctx.db.get(roomId);
  if (room === null) return;

  const host = room.hostPlayerId === undefined ? null : await ctx.db.get(room.hostPlayerId);
  if (host !== null && silenceOf(host) < AWAY_AFTER_MS) return;

  const seated = await playersInRoom(ctx, roomId);
  const successor = seated.find((player) => silenceOf(player) < AWAY_AFTER_MS);
  if (successor !== undefined && successor._id !== room.hostPlayerId) {
    await ctx.db.patch(room._id, { hostPlayerId: successor._id });
  }
}

/** Hold the running game on the exact clock remainder after confirmed silence. */
async function pauseForDisconnectedPlayer(
  ctx: MutationCtx,
  roomId: Id<'rooms'>,
): Promise<void> {
  const room = await ctx.db.get(roomId);
  if (room?.game === undefined || room.game.playerPaused === true) return;

  const paused = await pauseGameClock(ctx, room, Date.now());
  if (paused !== undefined) {
    await ctx.db.patch(room._id, { game: { ...paused, playerPaused: true } });
  }
}

/** Resume a player-held game once every remaining seat is truly present again. */
async function resumeWhenEveryoneReturns(
  ctx: MutationCtx,
  roomId: Id<'rooms'>,
): Promise<void> {
  const room = await ctx.db.get(roomId);
  const running = room?.game;
  if (room === null || running?.playerPaused !== true) return;

  const seated = await playersInRoom(ctx, roomId);
  if (seated.length === 0 || seated.some((player) => silenceOf(player) >= AWAY_AFTER_MS)) return;

  const recovered = { ...running, playerPaused: undefined };

  if (room.tvAway === true) {
    await ctx.db.patch(room._id, { game: recovered });
    return;
  }

  await ctx.db.patch(room._id, {
    game: await resumePausedGameClock(ctx, room, recovered, Date.now()),
  });
}

/**
 * A player's place in a room, as the phone holding that seat is told it: which
 * room, which player row, and the two things the Phone draws — the Room
 * Code on its chip and the name the room knows them by.
 *
 * `joinRoom` returns one of these and so does `session`, because taking a seat
 * and finding it again land the Phone in the same place. The nickname
 * comes back from the row rather than from what was typed: after a force-quit
 * the phone has nothing but its token, and the name on the TV is the room's to
 * state.
 */
const playerSessionFields = {
  playerId: v.id('players'),
  roomId: v.id('rooms'),
  code: v.string(),
  nickname: v.string(),
  // The phone's own avatar, so it can draw itself without waiting for the
  // roster to arrive. It is on the roster too — every *other* phone needs it
  // from there — but a screen that drew its own player from a subscription
  // would flash an empty circle on every launch.
  avatar: avatarValidator,
};

/**
 * Puts a phone in a room: the Phone sends the code from the TV and the
 * nickname its owner typed, and the room gains a seat.
 *
 * The two rules it enforces against the room — the ten-player cap and one
 * nickname per room — are read-then-write, and both hold exactly rather than
 * probably for the reason
 * `openRoom`'s code draw does (rooms.ts): Convex mutations are serializable
 * transactions, and the index read below joins this transaction's read set. A
 * concurrent `joinRoom` inserting into the same room writes into the range this
 * one read, which invalidates it, so Convex re-runs this mutation against the
 * committed rows — where the seat count is one higher and the nickname is
 * taken. Ten phones tapping Join in the same instant therefore seat ten
 * players, not eleven, and one "Sam", not two.
 *
 * Reading the room's whole roster rather than looking one nickname up is
 * deliberate: it is the read the cap needs anyway, it is bounded by
 * `ROOM_PLAYER_CAP` rows, and it puts every player of the room in the read set
 * — which is precisely the range a competing join writes into.
 *
 * The Session Token it mints goes back to this phone alone. It is what makes
 * the seat survive the app: see `session` below.
 */
export const joinRoom = mutation({
  args: {
    code: v.string(),
    nickname: v.string(),
    avatar: v.string(),
    guestId: v.optional(v.string()),
  },
  returns: v.object({ ...playerSessionFields, sessionToken: v.string() }),
  handler: async (ctx, args) => {
    const code = normalizeRoomCode(args.code);
    const nickname = args.nickname.trim();

    // Answered first, and without touching the database: whether a name can be
    // worn at all is a property of what was typed, not of any room. The trim
    // above happens before the question, so a nickname of spaces is a nickname
    // of nothing.
    if (!isUsableNickname(nickname)) {
      throw new ConvexError<JoinRejection>({
        kind: 'nameUnusable',
        maxLength: NICKNAME_MAX_LENGTH,
      });
    }

    // Asked here for the same reason as the nickname above, and answered the
    // same way: whether an avatar exists at all is a property of what arrived,
    // not of any room.
    if (!isAvatarId(args.avatar)) {
      throw new ConvexError<JoinRejection>({ kind: 'avatarUnknown', avatar: args.avatar });
    }

    if (args.guestId !== undefined && !isGuestId(args.guestId)) {
      throw new ConvexError<JoinRejection>({ kind: 'guestIdInvalid' });
    }

    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (q) => q.eq('code', code))
      .first();

    if (room === null) {
      throw new ConvexError<JoinRejection>({ kind: 'roomNotFound', code });
    }

    await limitJoin(ctx, room._id, args.guestId);

    const seated = await playersInRoom(ctx, room._id);

    // The cap is checked before the nickname on purpose: when both rules bite,
    // "name taken" would send someone off to think of another name for a room
    // that has no seat left for any name.
    if (seated.length >= ROOM_PLAYER_CAP) {
      throw new ConvexError<JoinRejection>({ kind: 'roomFull', cap: ROOM_PLAYER_CAP });
    }

    if (seated.some((player) => sameNickname(player.nickname, nickname))) {
      throw new ConvexError<JoinRejection>({ kind: 'nameTaken', nickname });
    }

    // One avatar per room, enforced where the nickname rule is and by the same
    // read-then-write: this handler already collects every player of the room,
    // so a competing join writes into the range this one read and Convex re-runs
    // it. The colour picker used to hold this rule on its own mutation; the
    // choice moved to the join form, so the rule moved with it.
    if (seated.some((player) => player.avatar === args.avatar)) {
      throw new ConvexError<JoinRejection>({ kind: 'avatarTaken', avatar: args.avatar });
    }

    const sessionToken = generateSessionToken();
    const playerId = await ctx.db.insert('players', {
      roomId: room._id,
      nickname,
      sessionToken,
      // Joining is the first thing this phone says, so it is also the first
      // beat: a phone that joins and is never heard from again goes away on the
      // same schedule as one that stops mid-party.
      lastSeenAt: Date.now(),
      away: false,
      avatar: args.avatar,
      guestId: args.guestId,
    });
    await watchForSilence(ctx, playerId);

    // The first phone in the room runs it. The read of `room` above is in this
    // transaction's read set, so two players joining an empty room at the same
    // instant cannot both find the pointer empty: the second is re-run against
    // the row the first wrote, and finds the room already has a host.
    if (await needsHost(ctx, room)) {
      await ctx.db.patch(room._id, { hostPlayerId: playerId });
    }

    return { playerId, roomId: room._id, code, nickname, avatar: args.avatar, sessionToken };
  },
});

/**
 * The seat a Session Token still holds, or `null` if it holds none.
 *
 * This is rejoining, and it is a query rather than a mutation because nothing
 * changes: force-quitting an app does not give up a seat, so a phone coming
 * back is not asking for one — it is asking which one is already its own. That
 * is the whole reason the roster cannot grow a duplicate. The Phone reads
 * this before it will show anybody a join form
 * (`apps/phone/src/platform/session/session.ts`).
 *
 * The room is read too, and a token whose room is gone answers `null`: the
 * Phone cannot draw the Room Code chip without it, and a seat in a room
 * that no longer exists is not a seat. A phone whose room expired therefore
 * comes back to the Join Screen — which is the whole of what a player has to do
 * about a party that ended while their phone was in a pocket. `expireRoom`
 * deletes the players with the room in one transaction, so the half-deleted
 * state this guards against is an ordering nobody can observe rather than one
 * anybody reaches.
 */
export const session = query({
  args: { sessionToken: v.string() },
  returns: v.union(v.null(), v.object(playerSessionFields)),
  handler: async (ctx, args) => {
    const player = await playerForSession(ctx, args.sessionToken);

    if (player === null) {
      return null;
    }

    const room = await ctx.db.get(player.roomId);

    if (room === null) {
      return null;
    }

    return {
      playerId: player._id,
      roomId: room._id,
      code: room.code,
      nickname: player.nickname,
      avatar: player.avatar,
    };
  },
});

/**
 * "Still here" — the Phone's heartbeat, sent every `HEARTBEAT_INTERVAL_MS`
 * while the app is in front of its owner and not at all while it is not
 * (`apps/phone/src/platform/presence/presence.ts`). Backgrounding a phone is therefore the
 * same event to a room as losing it: the beats stop, and the room finds out by
 * not being told.
 *
 * The Session Token is what says whose beat this is, for the reason the token
 * exists at all. Keying it on the `playerId` the roster hands to every screen in
 * the room would let any client hold any other player present, and presence is
 * the one thing a phone asserts about itself.
 *
 * A token no seat answers to is accepted and ignored rather than refused: the
 * seat may have gone with an expired room, and a phone beating into a room that
 * is no longer there has nothing to do about it that this mutation could tell it.
 */
export const heartbeat = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const player = await playerForSession(ctx, args.sessionToken);

    if (player === null) {
      return null;
    }

    await ctx.db.patch(player._id, { lastSeenAt: Date.now(), away: false });

    // Coming back: the chain that had been watching them ended when it marked
    // them away, so their return is what starts a new one. It also repairs the
    // retained Host pointer when the whole room went quiet and this is the first
    // connected player back.
    if (player.away) {
      await restoreConnectedHost(ctx, player.roomId);
      await watchForSilence(ctx, player._id);
      await resumeWhenEveryoneReturns(ctx, player.roomId);
    }

    return null;
  },
});

/**
 * The room noticing that a phone has gone quiet — scheduled by whoever last
 * heard from it (see `watchForSilence`), and the only thing that sets Away.
 *
 * It is a scheduled write rather than a comparison made when the roster is read,
 * because "away" has to reach a television nobody is touching. A Convex query
 * re-runs when the rows it read change, not when time passes, so a roster that
 * worked out away-ness from `lastSeenAt` would go on showing a room full of
 * present players until somebody happened to join. A write is what pushes; this
 * is the write.
 *
 * Internal, because it is the room talking to itself: no phone gets to declare
 * a player away.
 */
export const markAway = internalMutation({
  args: { playerId: v.id('players') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);

    // The row can be gone by now — room expiry deletes players — and an already
    // away player is a chain that has done its work.
    if (player === null || player.away) {
      return null;
    }

    const silence = silenceOf(player);

    if (silence < AWAY_AFTER_MS) {
      // They have beaten since this check was scheduled. Re-arm for the moment
      // the beat we *have* heard goes stale, so the room acts at the deadline
      // rather than a whole interval past it.
      await watchForSilence(ctx, player._id, AWAY_AFTER_MS - silence);
      return null;
    }

    await ctx.db.patch(player._id, { away: true });
    // A host who has gone quiet is a host who has left the party, because the
    // room has no way to tell those apart. Doing it here rather than on a clock
    // of its own is what makes the handover punctual: the room passes the room
    // on at the same moment it gives up on the phone holding it, so the plan's
    // fifteen seconds are the ten-to-thirteen `AWAY_AFTER_MS` already spends,
    // with the rest left for the scheduler and the push to the clients.
    await handOverRoom(ctx, player);
    await pauseForDisconnectedPlayer(ctx, player.roomId);
    // And if there is nobody left to hand it to at all, the room starts its own
    // ten minutes. This is where it belongs for the same reason the handover is
    // here: going quiet is the only thing a room ever learns about a phone, so
    // the last phone going quiet is the only "everybody has left" it can have.
    await watchForDesertion(ctx, player.roomId);
    return null;
  },
});

/**
 * The seat a host control names, resolved against the room the Host runs — or
 * the refusal that says why it cannot be the target.
 *
 * A phone sends a `playerId` the roster handed every client, so the id itself is
 * public and proves nothing: the guard is that it names a seat *in this room*
 * (not a stale id, and not a seat in someone else's room) and not the Host's own
 * (there is no room to hand oneself, and no self to remove — a host who wants
 * out uses `leaveRoom`, which hands the room on for them).
 */
async function targetSeatIn(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  actor: Doc<'players'>,
  targetPlayerId: Id<'players'>,
): Promise<Doc<'players'>> {
  const target = await ctx.db.get(targetPlayerId);

  if (target === null || target.roomId !== room._id) {
    throw new ConvexError<HostControlRejection>({ kind: 'targetNotInRoom' });
  }

  if (target._id === actor._id) {
    throw new ConvexError<HostControlRejection>({ kind: 'targetIsSelf' });
  }

  return target;
}

/**
 * The Host hands the room to another player, and every screen follows the pill.
 *
 * The successor must be a phone the room is still hearing from — a room a game
 * runs in needs a host who can run it, the same reason the automatic
 * `handOverRoom` picks a connected seat. Presence is read off `lastSeenAt`
 * rather than the `away` flag for that same reason: the flag lags a phone going
 * quiet by up to a scheduled check, and inside a mutation the room knows better.
 *
 * Unlike the automatic handover, this is a deliberate act: the Host chose this
 * seat off the roster, so there is no "longest-connected" search — the named
 * seat is the successor, if it is present.
 */
export const transferHost = mutation({
  args: { sessionToken: v.string(), playerId: v.id('players') },
  returns: v.null(),
  handler: async (ctx, args) => {
    await limitHostCommand(ctx, args.sessionToken);
    const { player: actor, room } = await requireRoomHost(ctx, args.sessionToken);
    const target = await targetSeatIn(ctx, room, actor, args.playerId);

    if (silenceOf(target) >= AWAY_AFTER_MS) {
      throw new ConvexError<HostControlRejection>({ kind: 'targetAway' });
    }

    await ctx.db.patch(room._id, { hostPlayerId: target._id });
    return null;
  },
});

/**
 * The Host removes a player: their seat is deleted, which is the whole of
 * invalidating them.
 *
 * A deleted row answers no Session Token — `session` returns `null` and the
 * phone falls back to the Join Screen — so the removed person is out of the room
 * and can rejoin only as a fresh participant, exactly as the scope asks (there
 * is no ban list; a new join is a new seat). Any check still pending on the row
 * (`markAway`) finds it gone and does nothing, the same tolerance room expiry
 * already relies on.
 *
 * Allowed while a game is running: the target may be a phone that went quiet
 * mid-game and will not come back. The game's own state still lists them among
 * the players it was dealt, and the room does not rewrite it here — the beat
 * they are holding up resolves on the room's own server clock (the Question and
 * Vote timers), so a removal never strands a beat, it at most lets it run its
 * time out. A Host who does not want to wait ends the game.
 *
 * The target is never the Host (`targetSeatIn` refuses the Host's own seat), so
 * removal never unseats the room's host and needs no handover.
 */
export const removePlayer = mutation({
  args: { sessionToken: v.string(), playerId: v.id('players') },
  returns: v.null(),
  handler: async (ctx, args) => {
    await limitHostCommand(ctx, args.sessionToken);
    const { player: actor, room } = await requireRoomHost(ctx, args.sessionToken);
    const target = await targetSeatIn(ctx, room, actor, args.playerId);

    await ctx.db.delete(target._id);
    if (room.setup !== undefined) {
      await ctx.db.patch(room._id, {
        setup: {
          ...room.setup,
          readyPlayerIds: (room.setup.readyPlayerIds ?? []).filter((playerId) => playerId !== target._id),
        },
      });
    }
    await resumeWhenEveryoneReturns(ctx, room._id);
    return null;
  },
});

/**
 * A player gives up their seat on purpose — the scope's "leave", and the
 * control every phone now carries.
 *
 * It is nobody's power over anybody: a phone leaves its own seat, named by the
 * Session Token it already holds, and there is no target argument to get wrong.
 * That is the whole reason it needs none of Host authorization. The Host
 * leaves the same way everybody else does, and the room goes with them only in
 * the sense that `handOverRoom` hands it on — the same succession `markAway`
 * already uses when a host's phone goes quiet, so a departing host is a room
 * that changes hands rather than a room that ends.
 *
 * A token no seat answers to is accepted and ignored, as in `heartbeat`: the
 * seat may have gone with an expired room, and a phone leaving a room that is
 * no longer there has got what it wanted.
 *
 * The production room belongs to the TV, not to its current roster. Its last
 * leaver clears Host, game and browsing state so the same code returns to an
 * empty lobby; TV silence owns eventual deletion. Fixture/legacy rooms with no
 * TV credential still delete here so an orphaned code cannot leak forever.
 */
export const leaveRoom = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await limitMemberCommand(ctx, args.sessionToken);
    const player = await playerForSession(ctx, args.sessionToken);

    if (player === null) {
      return null;
    }

    // Before the row goes, so the successor is chosen from a roster this player
    // is still on and excluded from it by id — which is exactly what
    // `handOverRoom` does, and why it takes the departing row rather than an id.
    //
    // `true` is "this row is being deleted", which is what licenses handing the
    // room to a seat that has gone quiet. `markAway` passes nothing and keeps
    // its host; a leaver has no host to keep.
    await handOverRoom(ctx, player, true);
    await ctx.db.delete('players', player._id);

    const room = await ctx.db.get(player.roomId);

    if (room === null) {
      return null;
    }

    const remaining = await playersInRoom(ctx, player.roomId);

    if (remaining.length > 0) {
      if (room.setup !== undefined) {
        await ctx.db.patch(room._id, {
          setup: {
            ...room.setup,
            readyPlayerIds: (room.setup.readyPlayerIds ?? []).filter((playerId) => playerId !== player._id),
          },
        });
      }
      // The room lives on, and this is where it is handed back to its clock.
      //
      // Not optional, and not belt-and-braces. Leaving a room whose remaining
      // seats have *all* gone quiet strands it exactly as an emptied one would:
      // `markAway` has already run for those seats and returns early on an
      // away player, so it never re-reaches this watcher; the last call that
      // did reach it found the leaver still beating and so scheduled nothing.
      // Calling this watcher unconditionally keeps a room with remaining seats
      // on the correct presence clock.
      //
      // At `AWAY_AFTER_MS` of 13 seconds that is not an exotic case — it is one
      // other person with their phone in their pocket. `watchForDesertion`
      // self-guards on "not every player is away", so calling it unconditionally
      // costs a read and says exactly what is true: somebody just left, look
      // again at whether anyone is still here.
      await resumeWhenEveryoneReturns(ctx, player.roomId);
      await watchForDesertion(ctx, player.roomId);
      return null;
    }

    const tvSession = await ctx.db
      .query('tvSessions')
      .withIndex('by_room', (q) => q.eq('roomId', room._id))
      .first();

    if (tvSession !== null) {
      // The TV is still the room's owner. Stop anything the departed party was
      // playing, then show the same empty Room screen to the next party.
      await stopGameClock(ctx, room);
      await ctx.db.patch(room._id, {
        hostPlayerId: undefined,
        game: undefined,
        setup: undefined,
        browsingGameIndex: undefined,
      });
      return null;
    }

    await deleteRoom(ctx, room);
    return null;
  },
});

/**
 * A room's roster in join order — the TV subscribes to this and redraws its
 * seats the moment a player lands, which is the whole of "the name appears on
 * the TV".
 *
 * It projects each player rather than returning the row: the TV is a renderer
 * and gets what it draws. A player row carries the phone's Session Token, and
 * this projection is what keeps it off a screen the entire room is looking at.
 *
 * `away` is here because a seat is drawn differently for a player whose phone
 * has gone quiet, and `avatar` because a seat *is* one; `lastSeenAt` is not,
 * because the TV has no clock the room agrees with and no business deciding
 * this. `avatar` is also how the join form knows which avatars are spoken for —
 * the room's own answer, so a phone dims exactly what the server would refuse. `host` is here for the same reason
 * as `away` — and it is what a Phone reads to know whether *it* is the
 * host, since this is the one live subscription every client in the room
 * already holds. A phone finding itself by `playerId` on the roster it is on
 * learns of a handover within a round trip of the room deciding it, which no
 * one-shot answer at launch could do.
 */
export const roster = query({
  args: { roomId: v.id('rooms') },
  returns: v.array(
    v.object({
      playerId: v.id('players'),
      nickname: v.string(),
      away: v.boolean(),
      host: v.boolean(),
      avatar: avatarValidator,
    }),
  ),
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    const seated = await playersInRoom(ctx, args.roomId);

    return seated.map((player) => ({
      playerId: player._id,
      nickname: player.nickname,
      away: player.away,
      host: player._id === room?.hostPlayerId,
      avatar: player.avatar,
    }));
  },
});
