import type { GameDeadline, GameEvent, GameLogic } from '@huddle/domain';
import { gameLogicById } from '@huddle/game-registry/logic';

import type { HostPorts } from './ports';
import type { StoredGame } from './state';

export type DecodedRuntime = {
  readonly game: GameLogic;
  readonly state: unknown;
};

export type DeadlineResult =
  | { readonly ok: true; readonly deadline?: GameDeadline }
  | { readonly ok: false };

export function runtimeFailure(log: HostPorts['log'], roomId: string, running: StoredGame, category: string): void {
  log?.('Huddle game runtime unavailable', {
    roomId,
    gameId: running.gameId,
    stateVersion: running.stateVersion,
    category,
  });
}

export function decodeStoredRuntime(
  log: HostPorts['log'],
  roomId: string,
  running: StoredGame,
): DecodedRuntime | undefined {
  const game = gameLogicById(running.gameId);
  if (game === undefined) {
    runtimeFailure(log, roomId, running, 'unknownGame');
    return undefined;
  }
  if (running.stateVersion !== game.stateVersion) {
    runtimeFailure(log, roomId, running, 'stateVersion');
    return undefined;
  }
  try {
    const state = game.decodeState(running.state);
    if (state === undefined) throw new Error('decoder returned undefined');
    return { game, state };
  } catch {
    runtimeFailure(log, roomId, running, 'stateDecode');
    return undefined;
  }
}

export function validatedDeadline(
  log: HostPorts['log'],
  roomId: string,
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
      runtimeFailure(log, roomId, running, 'deadline');
      return { ok: false };
    }
    const event = game.decodeEvent(deadline.event);
    if (event === undefined) throw new Error('deadline event decoder returned undefined');
    return { ok: true, deadline: { ...deadline, event } };
  } catch {
    runtimeFailure(log, roomId, running, 'deadline');
    return { ok: false };
  }
}

export function projectRuntime(runtime: DecodedRuntime, viewer: string | undefined): unknown {
  try {
    const projected = runtime.game.redactStateFor(runtime.state, viewer);
    const state = runtime.game.decodeState(projected);
    return state === undefined ? undefined : state;
  } catch {
    return undefined;
  }
}

export type GameStep = { readonly game: GameLogic; readonly state: unknown; readonly deadline?: GameDeadline };

export function advanceGame(log: HostPorts['log'], roomId: string, running: StoredGame, event: GameEvent): GameStep | undefined {
  const runtime = decodeStoredRuntime(log, roomId, running);
  if (runtime === undefined) return undefined;
  const { game, state } = runtime;
  let decodedEvent: GameEvent;
  try {
    decodedEvent = game.decodeEvent(event);
    if (decodedEvent === undefined) throw new Error('event decoder returned undefined');
  } catch {
    runtimeFailure(log, roomId, running, 'eventDecode');
    return undefined;
  }
  let next: unknown;
  try {
    next = game.reduce(state, decodedEvent);
  } catch {
    runtimeFailure(log, roomId, running, 'reducer');
    return undefined;
  }
  if (next === undefined || next === state) return undefined;
  try {
    next = game.decodeState(next);
    if (next === undefined) throw new Error('reducer decoder returned undefined');
  } catch {
    runtimeFailure(log, roomId, running, 'reducerOutput');
    return undefined;
  }
  const deadline = validatedDeadline(log, roomId, running, game, next);
  if (!deadline.ok) return undefined;
  return { game, state: next, ...(deadline.deadline === undefined ? {} : { deadline: deadline.deadline }) };
}
