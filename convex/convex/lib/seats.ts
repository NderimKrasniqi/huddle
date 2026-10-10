import { AWAY_AFTER_MS } from '@huddle/domain';

import { internal } from '../_generated/api';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { pauseGameClock, resumePausedGameClock } from './gameClock';
import { playersInRoom, withSeenAt } from './presence';

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
export async function watchForSilence(
  ctx: MutationCtx,
  playerId: Id<'players'>,
  after: number = AWAY_AFTER_MS,
): Promise<void> {
  await ctx.scheduler.runAfter(after, internal.players.markAway, { playerId });
}

/** How long it has been since the room last heard from this player's phone. */
export function silenceOf(player: Doc<'players'>): number {
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
export async function needsHost(ctx: MutationCtx, room: Doc<'rooms'>): Promise<boolean> {
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
export async function handOverRoom(
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

  const seated = await withSeenAt(ctx, await playersInRoom(ctx, departing.roomId));
  // The departing player is excluded by id rather than by their own silence,
  // which is a number this very call was prompted by: the point is that a host
  // cannot succeed themselves, and that should not rest on arithmetic.
  const others = seated.filter((player) => player._id !== departing._id);
  const beating = others
    .filter((player) => silenceOf(player) < AWAY_AFTER_MS)
    .reduce<(typeof others)[number] | undefined>((best, player) => (best === undefined || silenceOf(player) < silenceOf(best) ? player : best), undefined);
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
export async function restoreConnectedHost(ctx: MutationCtx, roomId: Id<'rooms'>): Promise<void> {
  const room = await ctx.db.get(roomId);
  if (room === null) return;

  const hostRow = room.hostPlayerId === undefined ? null : await ctx.db.get(room.hostPlayerId);
  const host = hostRow === null ? null : (await withSeenAt(ctx, [hostRow]))[0] ?? null;
  if (host !== null && silenceOf(host) < AWAY_AFTER_MS) return;

  const seated = await withSeenAt(ctx, await playersInRoom(ctx, roomId));
  const successor = seated.find((player) => silenceOf(player) < AWAY_AFTER_MS);
  if (successor !== undefined && successor._id !== room.hostPlayerId) {
    await ctx.db.patch(room._id, { hostPlayerId: successor._id });
  }
}

/** Hold the running game on the exact clock remainder after confirmed silence. */
export async function pauseForDisconnectedPlayer(
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
export async function resumeWhenEveryoneReturns(
  ctx: MutationCtx,
  roomId: Id<'rooms'>,
): Promise<void> {
  const room = await ctx.db.get(roomId);
  const running = room?.game;
  if (room === null || running?.playerPaused !== true) return;

  const seated = await withSeenAt(ctx, await playersInRoom(ctx, roomId));
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
