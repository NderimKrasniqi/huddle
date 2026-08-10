import type { GameModule, RunningGame, RunningGameResponse } from '@huddle/game-core';

import { GAME_REGISTRY } from './registry';

export type { RunningGameResponse };

/**
 * What a client should be drawing, given what the room says it is playing.
 *
 * Both clients ask this and neither names a game: the TV and the Controller
 * each hold the same two answers, and the module they mount comes out of the
 * Registry by the id the room stored. That is the whole of "the hub renders
 * purely from the registry" on the client side.
 */
export type RunningGameScreen =
  /** Draw the lobby: the room is between games or the subscription has not answered. */
  | { readonly kind: 'lobby' }
  /** Draw this module's screen, on this state. */
  | {
      readonly kind: 'game';
      readonly module: GameModule;
      readonly state: unknown;
      readonly clockRemainingMs?: number;
    }
  /** The room is paused and no game controls should mount. */
  | { readonly kind: 'paused'; readonly gameId: string; readonly reason: 'tvDisconnected' }
  /** The stored runtime failed closed and no state is available to clients. */
  | { readonly kind: 'unavailable'; readonly gameId: string };

/** The installed module answering to `gameId`, or `undefined` if none does. */
export function gameModuleById(gameId: string): GameModule | undefined {
  return GAME_REGISTRY.find((game) => game.metadata.id === gameId);
}

/**
 * The screen a client should mount for the room's running game.
 *
 * `undefined` means the subscription has not answered yet, and it is treated as
 * the lobby on purpose: every client in a room is already on its lobby when it
 * asks, so the in-flight moment draws what is on screen rather than a flash of
 * something else. The room's real answer arrives a round trip later either way.
 *
 * A game this build does not have is `unavailable`, with no state. The apps use
 * the same fail-closed surface as a removed or undecodable server runtime; a
 * Host still receives the room-level Back to lobby control from the seated
 * surface model, so an out-of-date client cannot strand the room.
 */
export function runningGameScreen(
  running: RunningGameResponse | RunningGame | undefined,
): RunningGameScreen {
  if (running === null || running === undefined) {
    return { kind: 'lobby' };
  }

  // Keep accepting the pre-6.2 shape as a package compatibility contract. New
  // runtime queries always use the `kind: 'running'` branch below.
  const response =
    'kind' in running
      ? running
      : { kind: 'running' as const, gameId: running.gameId, state: running.state };

  if (response.kind === 'paused') {
    return { kind: 'paused', gameId: response.gameId, reason: response.reason };
  }

  if (response.kind === 'unavailable') {
    return { kind: 'unavailable', gameId: response.gameId };
  }

  const module = gameModuleById(response.gameId);

  return module === undefined
    ? { kind: 'unavailable', gameId: response.gameId }
    : {
        kind: 'game',
        module,
        state: response.state,
        ...(response.clockRemainingMs === undefined
          ? {}
          : { clockRemainingMs: response.clockRemainingMs }),
      };
}
