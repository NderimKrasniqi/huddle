import type { GameLogic, GameLogicRegistry } from '@huddle/game-core';
import { triviaGameLogic } from '@huddle/game-trivia/logic';

/**
 * The installed games as the server holds them: rules only, no screens.
 *
 * Same games as `./registry` and in the same order — `registry.test.ts` is what
 * holds the two lists to each other. It is a separate entry point rather than a
 * filter over the other list because the point is what is *not* imported: the
 * Convex mutations that seed and reduce a game's state reach for this one, and
 * a module's screens are React Native that has no business in a server bundle.
 */
export const GAME_LOGIC_REGISTRY: GameLogicRegistry = [triviaGameLogic];

/**
 * The installed game answering to `gameId`, or `undefined` if none does.
 *
 * The id arrives from a phone (the Host names the game it is starting), so "no
 * such game" is an ordinary answer here and not an exceptional one — the caller
 * turns it into the room's refusal.
 */
export function gameLogicById(gameId: string): GameLogic | undefined {
  return GAME_LOGIC_REGISTRY.find((game) => game.metadata.id === gameId);
}
