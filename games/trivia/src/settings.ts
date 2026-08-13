import { settingsFrom, type GameSettings, type GameSettingsSchema } from '@huddle/domain';

export const TRIVIA_SETTINGS_SCHEMA: GameSettingsSchema = [{
  key: 'questions',
  label: 'Questions',
  options: [{ value: '5', label: '5' }, { value: '10', label: '10' }],
  defaultValue: '10',
}];

export const TRIVIA_SETTINGS_PRESENTATION = {
  presets: [
    { mode: 'quick' as const, label: 'Quick', settings: { questions: '5' } },
    { mode: 'standard' as const, label: 'Standard', settings: { questions: '10' } },
  ],
  customSettingKeys: ['questions'],
} as const;

export type TriviaSettings = { readonly questions: 5 | 10 };

export function triviaSettings(chosen: GameSettings | undefined): TriviaSettings {
  return { questions: settingsFrom(TRIVIA_SETTINGS_SCHEMA, chosen).questions === '5' ? 5 : 10 };
}
