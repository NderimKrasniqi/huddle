import type { GameRegistry } from '@huddle/contracts';
import { triviaGameModule } from '@huddle/game-trivia';
import { bombSquadGameModule } from '@huddle/game-bomb-squad';

/**
 * The installed games, in the order the hub offers them: the client-side
 * registration seam. The TV's shelf and the Host's picker read a game out of
 * it and render it through the client contract. The server has a separate
 * `GAME_LOGIC_REGISTRY` in `logic.ts`, so Convex never pulls React Native
 * screens or client art into its bundle; `registry.test.ts` keeps the two
 * lists aligned. Adding a game is one import and one entry in each.
 */
export const GAME_REGISTRY: GameRegistry = [triviaGameModule, bombSquadGameModule];
