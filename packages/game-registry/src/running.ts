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
  /**
   * Draw the lobby: the room is between games, has yet to answer, or is playing
   * something this build does not have.
   */
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
 * A game this build does not have is the lobby too. There used to be a third
 * answer and a screen on each surface for it, on the argument that a lobby
 * would invite the player to act on a room that is mid-game and the honest
 * thing to say is that the app is behind. The approved design draws neither
 * screen, so both are gone and the trade was made knowingly: an out-of-date
 * phone in a room playing a game it lacks now waits with everybody else instead
 * of being told to update, and rejoins when the room returns to its lobby.
 *
 * **The Host is the exception, and the lobby handles it.** Only `endGame`
 * clears the running game and only the Host may call it, so a Host whose build
 * lacks the module — reachable, since `handOverRoom` can hand a room over
 * mid-game — would be sitting in a room nothing in it could move. The deleted
 * screen carried a Back to lobby for exactly that. The Host's room now draws
 * the same control whenever the room reports a game and this answer is still
 * the lobby (`stranded`, in `apps/controller/app/index.tsx`), which is the one
 * place that can tell the difference between "between games" and "playing
 * something I cannot draw" — this function deliberately cannot.
 */
export function runningGameScreen(
  running: RunningGameResponse | RunningGame | undefined,
): RunningGameScreen {
  if (running === null || running === undefined) {
    return { kind: 'lobby' };
  }

  // Keep accepting the pre-6.2 shape for one release so older callers can
  // adopt the discriminated response without a flag day. New runtime queries
  // always use the `kind: 'running'` branch below.
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
