import { COUNTDOWN_MS, readiness } from '@huddle/domain';
import { gameLogicById } from '@huddle/game-registry/logic';

import { internal } from '../_generated/api';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { playersInRoom } from './presence';

type Setup = NonNullable<Doc<'rooms'>['setup']>;

/**
 * The setup with no countdown on it. Used by every write that leaves the
 * countdown, so the stage, the deadline and the scheduled start always go
 * together.
 */
export function withoutCountdown(setup: Setup): Setup {
  const { countdownEndsAt: _endsAt, countdownJob: _job, ...rest } = setup;
  return { ...rest, stage: setup.stage === 'countdown' ? 'ready' : setup.stage };
}

/** Cancel the scheduled start, if this room has one. */
export async function cancelCountdownJob(ctx: MutationCtx, setup: Setup | undefined): Promise<void> {
  if (setup?.countdownJob !== undefined) await ctx.scheduler.cancel(setup.countdownJob);
}

/** Whether the ready check on this room is complete right now. */
export async function readyCheckComplete(ctx: MutationCtx, room: Doc<'rooms'>): Promise<boolean> {
  const setup = room.setup;
  if (setup === undefined || room.game !== undefined || room.tvAway === true) return false;
  const seats = await playersInRoom(ctx, room._id);
  return readiness({
    stage: setup.stage ?? 'configuring',
    seats: seats.map((seat) => ({ playerId: seat._id, away: seat.away })),
    readyPlayerIds: setup.readyPlayerIds ?? [],
    playerRange: gameLogicById(setup.gameId)?.metadata.playerRange,
  }).complete;
}

/**
 * Starts the countdown on a room whose ready check is complete. The caller has
 * already checked that the room may start; this only schedules the start.
 */
export async function beginCountdown(ctx: MutationCtx, room: Doc<'rooms'>): Promise<void> {
  const setup = room.setup;
  if (setup === undefined) return;
  const endsAt = Date.now() + COUNTDOWN_MS;
  const job = await ctx.scheduler.runAfter(COUNTDOWN_MS, internal.gameSetup.launchCountdown, {
    roomId: room._id,
    endsAt,
  });
  await ctx.db.patch(room._id, {
    setup: { ...setup, stage: 'countdown', countdownEndsAt: endsAt, countdownJob: job },
  });
}

/**
 * Stops the room's countdown if its ready check no longer holds.
 *
 * Called after every write that can break the ready check: a player
 * un-readying, joining, leaving, being removed or going away, and the TV going
 * away. The room goes back to its ready check with everyone's Ready kept, and
 * the Host starts again when it is complete. Only the Host's Start begins a
 * countdown, so this never starts one, and calling it twice is harmless.
 */
export async function reconcileCountdown(ctx: MutationCtx, roomId: Id<'rooms'>): Promise<void> {
  const room = await ctx.db.get(roomId);
  const setup = room?.setup;
  if (room === null || setup === undefined || setup.stage !== 'countdown') return;
  if (await readyCheckComplete(ctx, room)) return;
  await cancelCountdownJob(ctx, setup);
  await ctx.db.patch(roomId, { setup: withoutCountdown(setup) });
}
