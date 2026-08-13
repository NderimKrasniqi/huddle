import type { GameModule } from '@huddle/domain';
import { TriviaPhoneScreen } from './phone-screen';
import { triviaMetadata } from './metadata';
import { TRIVIA_SETTINGS_PRESENTATION, TRIVIA_SETTINGS_SCHEMA } from './settings';
import { TriviaTvScreen } from './tv-screen';
import type { TriviaEvent, TriviaState } from './types';

export const triviaGameModule: GameModule<TriviaState, TriviaEvent> = {
  metadata: triviaMetadata,
  settingsSchema: TRIVIA_SETTINGS_SCHEMA,
  settingsPresentation: TRIVIA_SETTINGS_PRESENTATION,
  screens: { tv: TriviaTvScreen, phone: TriviaPhoneScreen },
};
