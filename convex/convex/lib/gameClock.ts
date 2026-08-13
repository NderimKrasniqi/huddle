import type { GameDeadline, GameLogic } from '@huddle/domain';

import { internal } from '../_generated/api';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import {
  decodeStoredRuntime,
  type DeadlineResult,
  type StoredGame,
  validatedDeadline,
} from './gameRuntime';

/** A scheduler clock kept alongside the room's game document. */
export type RoomClock = {
  readonly deadline?: Id<'_scheduled_functions'>;
  readonly deadlineAt?: number;
};

/** Normalize a remaining duration without allowing a negative pause. */
export function remainingMs(deadlineAt: number | undefined, now: number): number | undefined {
  return deadlineAt === undefined ? undefined : Math.max(0, deadlineAt - now);
}

/** Read a live clock without clamping; reducers decide what overdue means. */
export function clockRemainingMs(clock: RoomClock, now: number): number | undefined {
  return clock.deadlineAt === undefined ? undefined : clock.deadlineAt - now;
}

/** Cancel a scheduled deadline when its room lifecycle stops owning it. */
export async function cancelDeadline(
  ctx: MutationCtx,
  deadline: Id<'_scheduled_functions'> | undefined,
): Promise<void> {
  if (deadline !== undefined) await ctx.scheduler.cancel(deadline);
}

/** Stop the current game clock, if the room has one. */
export async function stopGameClock(ctx: MutationCtx, room: Doc<'rooms'>): Promise<void> {
  await cancelDeadline(ctx, room.game?.deadline);
}

/** Stop a running clock once and preserve the exact remainder for recovery. */
export async function pauseGameClock(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  now: number,
): Promise<StoredGame | undefined> {
  const running = room.game;
  if (running === undefined) return undefined;

  // Another recovery boundary already owns the stopped clock. Its remainder is
  // the one to keep: pausing again must not replace fifteen seconds with zero.
  if (running.deadline === undefined && running.deadlineAt === undefined) {
    return running;
  }

  await cancelDeadline(ctx, running.deadline);
  return {
    ...running,
    deadline: undefined,
    deadlineAt: undefined,
    pausedRemainingMs: remainingMs(running.deadlineAt, now),
  };
}

async function scheduleDeadline(
  ctx: MutationCtx,
  roomId: Id<'rooms'>,
  gameId: string,
  deadline: GameDeadline,
  afterMs: number,
  now: number,
): Promise<RoomClock> {
  const scheduled = await ctx.scheduler.runAfter(afterMs, internal.games.reachDeadline, {
    roomId,
    gameId,
    event: deadline.event,
  });
  return { deadline: scheduled, deadlineAt: now + afterMs };
}

/** Stop the prior beat and arm the validated deadline for the next one. */
export async function windGameClock(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  running: StoredGame,
  game: GameLogic,
  state: unknown,
  candidate?: GameDeadline,
): Promise<RoomClock | undefined> {
  const checked =
    candidate === undefined
      ? validatedDeadline(room._id, running, game, state)
      : ({ ok: true, deadline: candidate } satisfies DeadlineResult);
  if (!checked.ok) return undefined;

  await stopGameClock(ctx, room);
  if (checked.deadline === undefined) return {};

  return await scheduleDeadline(
    ctx,
    room._id,
    game.metadata.id,
    checked.deadline,
    checked.deadline.afterMs,
    Date.now(),
  );
}

/** Re-arm a paused room from the exact remainder captured at disconnect. */
export async function resumeGameClock(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  remaining: number,
  now: number,
): Promise<RoomClock | undefined> {
  const running = room.game;
  if (running === undefined) return {};

  const runtime = decodeStoredRuntime(room._id, running);
  if (runtime === undefined) return undefined;
  const checked = validatedDeadline(room._id, running, runtime.game, runtime.state);
  if (!checked.ok || checked.deadline === undefined) return undefined;

  return await scheduleDeadline(
    ctx,
    room._id,
    running.gameId,
    checked.deadline,
    remaining,
    now,
  );
}

/** Restore a stopped stored game and clear the pause-only clock fields. */
export async function resumePausedGameClock(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  running: StoredGame,
  now: number,
): Promise<StoredGame> {
  const remaining = Math.max(0, running.pausedRemainingMs ?? 0);
  const clock = await resumeGameClock(ctx, { ...room, game: running }, remaining, now);

  return {
    ...running,
    deadline: clock?.deadline,
    deadlineAt: clock?.deadlineAt,
    pausedRemainingMs: undefined,
  };
}
