import type { GameModule } from '@huddle/domain';

import { sumoBumpersMetadata } from './metadata';
import { SumoBumpersPhoneScreen } from './phone-screen';
import { SUMO_SETTINGS_SCHEMA } from './settings';
import { SumoBumpersTvScreen } from './tv-screen';
import type { SumoEvent, SumoState } from './types';

export const sumoBumpersGameModule: GameModule<SumoState, SumoEvent> = {
  metadata: sumoBumpersMetadata,
  settingsSchema: SUMO_SETTINGS_SCHEMA,
  screens: { tv: SumoBumpersTvScreen, phone: SumoBumpersPhoneScreen },
};
