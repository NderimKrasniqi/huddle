import type { GameModule } from '@huddle/game-core';

import { triviaGameLogic, type TriviaEvent, type TriviaState } from './logic';

/**
 * Trivia: the first Game Module, and the reason the interface exists.
 *
 * The rules come from `./logic`, which the Convex server imports on its own;
 * this file is that plus the two screens, and it is what the TV app and the
 * Controller mount. The screens arrive task by task through Phase 3
 * (docs/implementation-plan.md): the four answer buttons on the phone, the
 * question and reveal screens on the TV.
 */
export const triviaGameModule: GameModule<TriviaState, TriviaEvent> = {
  ...triviaGameLogic,
  screens: {
    // The TV question, reveal and scoreboard screens, and the phone's four
    // answer buttons, are their own tasks later in Phase 3. A game that draws
    // nothing is what "not yet" looks like from the hub.
    tv: () => null,
    controller: () => null,
  },
};
