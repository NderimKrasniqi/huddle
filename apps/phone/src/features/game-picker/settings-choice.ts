import {
  type GameSettings,
  type GameSettingsPresentation,
  type GameSettingsSchema,
  settingsFrom,
} from '@huddle/domain';

export type SettingsChoice = {
  readonly gameId: string;
  readonly settings: GameSettings;
};

function chosenFor(
  gameId: string,
  choice: SettingsChoice | undefined,
): GameSettings | undefined {
  return choice?.gameId === gameId ? choice.settings : undefined;
}

export function settingsToStart(
  schema: GameSettingsSchema,
  gameId: string,
  choice: SettingsChoice | undefined,
): GameSettings {
  return settingsFrom(schema, chosenFor(gameId, choice));
}

type SettingOptionControl = {
  readonly value: string;
  readonly label: string;
  readonly chosen: boolean;
};

export type SettingControl = {
  readonly key: string;
  readonly label: string;
  readonly options: readonly SettingOptionControl[];
};

export function settingsControls(
  schema: GameSettingsSchema,
  gameId: string,
  choice: SettingsChoice | undefined,
  presentation?: GameSettingsPresentation,
): readonly SettingControl[] {
  const starting = settingsToStart(schema, gameId, choice);
  const visibleKeys = presentation?.customSettingKeys;

  return schema
    .filter((setting) => visibleKeys === undefined || visibleKeys.includes(setting.key))
    .map((setting) => ({
    key: setting.key,
    label: setting.label,
    options: setting.options
      .filter((option) => {
        const allowed = presentation?.customOptions?.[setting.key];
        return allowed === undefined || allowed.includes(option.value);
      })
      .map((option) => ({
      value: option.value,
      label: option.label,
      chosen: starting[setting.key] === option.value,
      })),
    }));
}
