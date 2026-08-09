import type { GameLogic } from '@huddle/game-core';
import { gameLogicById } from '@huddle/game-registry/logic';

import type { Doc } from '../_generated/dataModel';

export type StoredGame = NonNullable<Doc<'rooms'>['game']>;

export type DecodedRuntime = {
  readonly game: GameLogic;
  readonly state: unknown;
};

/** Resolve and decode persisted game state without ever returning raw invalid data. */
export function decodeStoredRuntime(running: StoredGame): DecodedRuntime | undefined {
  const game = gameLogicById(running.gameId);
  if (game === undefined || running.stateVersion !== game.stateVersion) return undefined;

  try {
    return { game, state: game.decodeState(running.state) };
  } catch {
    return undefined;
  }
}

/** Validate a projected state before it crosses a public query boundary. */
export function projectRuntime(
  runtime: DecodedRuntime,
  viewer: string | undefined,
): unknown | undefined {
  try {
    const projected = runtime.game.redactStateFor(runtime.state, viewer);
    return runtime.game.decodeState(projected);
  } catch {
    return undefined;
  }
}
