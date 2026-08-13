import type { GameModule } from '@huddle/domain';
import { VotingPhoneScreen } from './phone-screen';
import { votingMetadata } from './metadata';
import { VOTING_SETTINGS_PRESENTATION, VOTING_SETTINGS_SCHEMA } from './settings';
import { VotingTvScreen } from './tv-screen';
import type { VotingEvent, VotingState } from './types';
export const votingGameModule: GameModule<VotingState, VotingEvent> = { metadata: votingMetadata, settingsSchema: VOTING_SETTINGS_SCHEMA, settingsPresentation: VOTING_SETTINGS_PRESENTATION, screens: { tv: VotingTvScreen, phone: VotingPhoneScreen } };
