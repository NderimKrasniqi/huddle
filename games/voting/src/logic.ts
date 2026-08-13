import type { GameLogic, GameSettings } from '@huddle/domain';
import { votingMetadata } from './metadata';
import { votingSettings, VOTING_SETTINGS_PRESENTATION, VOTING_SETTINGS_SCHEMA } from './settings';
import { votingStateSchema } from './schemas';
import type { VotingEvent, VotingState } from './types';
export const votingGameLogic: GameLogic<VotingState, VotingEvent, GameSettings> = { stateVersion: 2, decodeState: (value) => votingStateSchema.parse(value), decodeEvent: () => { throw new Error('Voting launch proof accepts no player events'); }, metadata: votingMetadata, settingsSchema: VOTING_SETTINGS_SCHEMA, settingsPresentation: VOTING_SETTINGS_PRESENTATION, createInitialState: ({ settings }) => ({ phase: 'entered', resolvedSettings: votingSettings(settings) }), reduce: (state) => state, redactStateFor: (state) => state };
