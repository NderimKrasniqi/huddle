import type { GameModule } from '@huddle/game-core';

import { VotingControllerScreen } from './controller-screen';
import { votingGameLogic, type VotingEvent, type VotingState } from './logic';
import { VotingTvScreen } from './tv-screen';

/**
 * Hot Takes: the second Game Module, and the proof the interface holds.
 *
 * The rules come from `./logic`, which the Convex server imports on its own;
 * this file is that plus the two screens, and it is what the TV app and the
 * Controller mount. It is assembled exactly as trivia's module is — the logic
 * spread with screens laid on top — so the module *is* its logic with a face,
 * which is what `registry.test.ts` checks by identity.
 */
export const votingGameModule: GameModule<VotingState, VotingEvent> = {
  ...votingGameLogic,
  screens: {
    tv: VotingTvScreen,
    controller: VotingControllerScreen,
  },
};
