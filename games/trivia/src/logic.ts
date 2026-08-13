import type { GameLogic, GameSettings } from '@huddle/domain';
import { triviaMetadata } from './metadata';
import { triviaSettings, TRIVIA_SETTINGS_PRESENTATION, TRIVIA_SETTINGS_SCHEMA } from './settings';
import { triviaStateSchema } from './schemas';
import type { TriviaEvent, TriviaState } from './types';

export const triviaGameLogic: GameLogic<TriviaState, TriviaEvent, GameSettings> = {
  stateVersion: 2,
  decodeState: (value) => triviaStateSchema.parse(value),
  decodeEvent: () => { throw new Error('Trivia launch proof accepts no player events'); },
  metadata: triviaMetadata,
  settingsSchema: TRIVIA_SETTINGS_SCHEMA,
  settingsPresentation: TRIVIA_SETTINGS_PRESENTATION,
  createInitialState: ({ settings }) => ({ phase: 'entered', resolvedSettings: triviaSettings(settings) }),
  reduce: (state) => state,
  redactStateFor: (state) => state,
};
