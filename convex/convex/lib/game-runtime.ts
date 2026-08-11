import type { GameDeadline, GameLogic } from '@huddle/game-core';
import { gameLogicById } from '@huddle/game-registry/logic';

import type { Doc, Id } from '../_generated/dataModel';

export type StoredGame = NonNullable<Doc<'rooms'>['game']>;

export type DecodedRuntime = {
  readonly game: GameLogic;
  readonly state: unknown;
};

export type DeadlineResult =
  | { readonly ok: true; readonly deadline?: GameDeadline }
  | { readonly ok: false };

/** Log only identifiers and a category; never tokens, events, or state. */
export function runtimeFailure(
  roomId: Id<'rooms'>,
  running: StoredGame,
  category: string,
): void {
  console.warn('Huddle game runtime unavailable', {
    roomId,
    gameId: running.gameId,
    stateVersion: running.stateVersion ?? null,
    category,
  });
}

/** Resolve and decode persisted game state without ever returning raw invalid data. */
export function decodeStoredRuntime(
  roomId: Id<'rooms'>,
  running: StoredGame,
): DecodedRuntime | undefined {
  const game = gameLogicById(running.gameId);
  if (game === undefined) {
    runtimeFailure(roomId, running, 'unknownGame');
    return undefined;
  }
  if (running.stateVersion !== game.stateVersion) {
    runtimeFailure(roomId, running, 'stateVersion');
    return undefined;
  }

  try {
    const state = game.decodeState(running.state);
    if (state === undefined) throw new Error('decoder returned undefined');
    return { game, state };
  } catch {
    runtimeFailure(roomId, running, 'stateDecode');
    return undefined;
  }
}

/** Validate and decode a module deadline before it reaches the scheduler. */
export function validatedDeadline(
  roomId: Id<'rooms'>,
  running: StoredGame,
  game: GameLogic,
  state: unknown,
): DeadlineResult {
  try {
    const deadline = game.deadline?.(state);
    if (deadline === undefined) return { ok: true };
    if (
      typeof deadline.beat !== 'string' ||
      deadline.beat.length === 0 ||
      !Number.isFinite(deadline.afterMs) ||
      deadline.afterMs < 0
    ) {
      runtimeFailure(roomId, running, 'deadline');
      return { ok: false };
    }
    const event = game.decodeEvent(deadline.event);
    if (event === undefined) throw new Error('deadline event decoder returned undefined');
    return { ok: true, deadline: { ...deadline, event } };
  } catch {
    runtimeFailure(roomId, running, 'deadline');
    return { ok: false };
  }
}

/** Validate a projected state before it crosses a public query boundary. */
export function projectRuntime(
  runtime: DecodedRuntime,
  viewer: string | undefined,
): unknown | undefined {
  try {
    const projected = runtime.game.redactStateFor(runtime.state, viewer);
    const state = runtime.game.decodeState(projected);
    return state === undefined ? undefined : state;
  } catch {
    return undefined;
  }
}
