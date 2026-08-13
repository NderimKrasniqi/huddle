import { settingsFrom, type GameSettings, type GameSettingsSchema } from '@huddle/domain';
export const VOTING_SETTINGS_SCHEMA: GameSettingsSchema = [{ key: 'rounds', label: 'Rounds', options: [{ value: '3', label: '3' }, { value: '5', label: '5' }], defaultValue: '3' }];
export const VOTING_SETTINGS_PRESENTATION = { presets: [{ mode: 'quick' as const, label: 'Quick', settings: { rounds: '3' } }, { mode: 'standard' as const, label: 'Standard', settings: { rounds: '5' } }], customSettingKeys: ['rounds'] } as const;
export type VotingSettings = { readonly rounds: 3 | 5 };
export function votingSettings(chosen: GameSettings | undefined): VotingSettings { return { rounds: settingsFrom(VOTING_SETTINGS_SCHEMA, chosen).rounds === '5' ? 5 : 3 }; }
