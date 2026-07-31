import type { GameRegistry } from '@huddle/game-core';
import { triviaGameModule } from '@huddle/game-trivia';

/**
 * The installed games, in the order the hub offers them.
 *
 * This list is the only place in Huddle that names a game. The TV's carousel,
 * the Host's picker and the mutation that starts a room all read a game out of
 * here and render or run it through the interface — so installing a second game
 * is this array growing by one, and nothing else (docs/project-scope.md:
 * "adding a hypothetical game #2 requires no hub changes").
 *
 * Trivia is alone in it for the whole MVP, which is exactly why it is a list:
 * a hub that reads a registry of one and a hub that reads a registry of six are
 * the same hub, and a hub written around the one game it has is not.
 */
export const GAME_REGISTRY: GameRegistry = [triviaGameModule];
