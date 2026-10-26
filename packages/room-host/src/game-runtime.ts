import type { GameDeadline, GameLogic } from '@huddle/domain';
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
