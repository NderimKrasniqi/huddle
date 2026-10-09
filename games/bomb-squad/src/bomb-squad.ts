import type { GameModule } from '@huddle/domain';

import { bombSquadMetadata } from './metadata';
import { BombSquadPhoneScreen } from './phone-screen';
import { BOMB_SETTINGS_SCHEMA } from './settings';
import { BombSquadTvScreen } from './tv-screen';
import type { BombEvent, BombState } from './types';

export const bombSquadGameModule: GameModule<BombState, BombEvent> = {
  metadata: bombSquadMetadata,
  settingsSchema: BOMB_SETTINGS_SCHEMA,
  screens: { tv: BombSquadTvScreen, phone: BombSquadPhoneScreen },
};
