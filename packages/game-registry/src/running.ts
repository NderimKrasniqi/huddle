import type { GameModule, RunningGame } from '@huddle/game-core';

import { GAME_REGISTRY } from './registry';

/**
 * What a client should be drawing, given what the room says it is playing.
 *
 * Both clients ask this and neither names a game: the TV and the Controller
 * each hold the same three answers, and the module they mount comes out of the
 * Registry by the id the room stored. That is the whole of "the hub renders
 * purely from the registry" on the client side.
 */
export type RunningGameScreen =
  /** Draw the lobby: the room is between games, or has yet to answer. */
  | { readonly kind: 'lobby' }
  /** Draw this module's screen, on this state. */
  | { readonly kind: 'game'; readonly module: GameModule; readonly state: unknown }
  /**
   * The room is playing something this build does not have.
   *
   * Not a theoretical case: a phone that has not been updated can walk into a
   * room whose TV has. It is drawn as its own thing rather than folded into the
   * lobby, because a lobby would invite the player to do something about a room
   * that is mid-game, and the honest thing to say is that the app is behind.
   */
  | { readonly kind: 'unknownGame'; readonly gameId: string };

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
 */
export function runningGameScreen(
  running: RunningGame | null | undefined,
): RunningGameScreen {
  if (running === null || running === undefined) {
    return { kind: 'lobby' };
  }

  const module = gameModuleById(running.gameId);

  return module === undefined
    ? { kind: 'unknownGame', gameId: running.gameId }
    : { kind: 'game', module, state: running.state };
}
