import type { GameRegistry } from '@huddle/game-core';
import { triviaGameModule } from '@huddle/game-trivia';
import { votingGameModule } from '@huddle/game-voting';

/**
 * The installed games, in the order the hub offers them.
 *
 * This list is the only place in Huddle that names a game. The TV's carousel,
 * the Host's picker and the mutation that starts a room all read a game out of
 * here and render or run it through the interface — so installing a second game
 * is this array growing by one, and nothing else (docs/project-scope.md:
 * "adding a hypothetical game #2 requires no hub changes").
 *
 * Hot Takes joining Trivia here is that promise kept: a whole second game — a
 * different loop, a different player range, private votes and no scoring —
 * installed by one import and one entry, with not a line of the hub touched to
 * carry it. That the list is what makes a game installed is exactly why it was
 * written as a list while Trivia was alone in it.
 */
export const GAME_REGISTRY: GameRegistry = [triviaGameModule, votingGameModule];
