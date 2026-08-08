import type { GameModule } from '@huddle/game-core';

import { TriviaControllerScreen } from './controller-screen';
import type { TriviaEvent, TriviaState } from './logic';
import { triviaMetadata } from './metadata';
import { TRIVIA_SETTINGS_SCHEMA } from './settings';
import { TriviaTvScreen } from './tv-screen';

/**
 * Trivia: the first Game Module, and the reason the interface exists.
 *
 * A client's view of trivia — its card (`./metadata`), the Host's options
 * (`./settings`), and the two screens — with the rules deliberately left off.
 * `./logic` holds the rules and deals from the Question Pack, so it is the
 * server's alone; this file takes only `TriviaState` and `TriviaEvent` from it
 * as *types*, which erase at compile time, leaving no runtime path from a
 * mounted trivia screen to a single answer (docs/implementation-plan.md 5.9).
 * Assembled field by field rather than spread from the logic for the same
 * reason: a spread would copy `createInitialState` onto the module and carry the
 * pack in behind it. This is what the TV app and the Controller mount.
 */
export const triviaGameModule: GameModule<TriviaState, TriviaEvent> = {
  metadata: triviaMetadata,
  settingsSchema: TRIVIA_SETTINGS_SCHEMA,
  screens: {
    tv: TriviaTvScreen,
    controller: TriviaControllerScreen,
  },
};
