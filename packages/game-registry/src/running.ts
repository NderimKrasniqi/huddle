import type { GameModule, RunningGame } from '@huddle/game-core';

import { GAME_REGISTRY } from './registry';

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
  | { readonly kind: 'game'; readonly module: GameModule; readonly state: unknown };

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
 * **Which it can only do if the Host is not the phone that is behind.** Only
 * `endGame` clears the running game, only the Host may call it, and the one
 * control that does is on the in-game screen — which needs the module. So a
 * Host on an older build (reachable: `handOverRoom` can hand a room over
 * mid-game) sits on a lobby whose Start button refuses with "This room is
 * already playing", and End Room, which takes every seat with it, is the only
 * way out. The deleted screen carried a Back to lobby for exactly this and said
 * so. Restoring the escape belongs to Phase 4, which owns the phone's lobby
 * navigation; it is written down here rather than left for someone to rediscover.
 */
export function runningGameScreen(
  running: RunningGame | null | undefined,
): RunningGameScreen {
  if (running === null || running === undefined) {
    return { kind: 'lobby' };
  }

  const module = gameModuleById(running.gameId);

  return module === undefined ? { kind: 'lobby' } : { kind: 'game', module, state: running.state };
}
