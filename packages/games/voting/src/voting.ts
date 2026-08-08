import type { GameModule } from '@huddle/game-core';

import { VotingControllerScreen } from './controller-screen';
import type { VotingEvent, VotingState } from './logic';
import { votingMetadata } from './metadata';
import { VOTING_SETTINGS_SCHEMA } from './settings';
import { VotingTvScreen } from './tv-screen';

/**
 * Hot Takes: the second Game Module, and the proof the interface holds.
 *
 * A client's view of the game — its card (`./metadata`), the Host's one option
 * (`./settings`), and the two screens — with the rules left to `./logic`, which
 * the Convex server imports on its own. Assembled field by field, exactly as
 * trivia's module is, rather than spread from the logic: the module carries no
 * `createInitialState`, so a client never runs the deal. What makes that urgent
 * for trivia — a spread would carry the Question Pack, and its answers, into the
 * bundle — does not apply here (Hot Takes' prompts are opinion, not answers, and
 * may ride along), but the shape is shared so the two games stay one pattern. This is
 * what the TV app and the Controller mount; `registry.test.ts` holds its
 * `metadata` to the logic's by identity.
 */
export const votingGameModule: GameModule<VotingState, VotingEvent> = {
  metadata: votingMetadata,
  settingsSchema: VOTING_SETTINGS_SCHEMA,
  screens: {
    tv: VotingTvScreen,
    controller: VotingControllerScreen,
  },
};
