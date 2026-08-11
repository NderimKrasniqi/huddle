import type { GameRegistry } from '@huddle/game-core';
import { triviaGameModule } from '@huddle/game-trivia';
import { votingGameModule } from '@huddle/game-voting';

/**
 * The installed games, in the order the hub offers them.
 *
 * This is the client-side registration seam. The TV's carousel and the Host's
 * picker read a game out of it and render it through the client contract. The
 * server intentionally has a separate `GAME_LOGIC_REGISTRY` in `logic.ts` so
 * Convex never pulls React Native screens or client art into its bundle. The
 * parity and bundle-seam tests keep these two lists aligned without collapsing
 * their ownership.
 *
 * Hot Takes joining Trivia here is that promise kept: a whole second game — a
 * different loop, a different player range, private votes and no scoring — is
 * installed by one matching import/entry in each registry seam, with not a line
 * of the hub touched to carry it.
 */
export const GAME_REGISTRY: GameRegistry = [triviaGameModule, votingGameModule];
