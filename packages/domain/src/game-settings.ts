import type {
  GameLifecycleRejection,
  GameSetting,
  GameSettings,
  GameSettingsMode,
  GameSettingsPresentation,
  GameSettingsSchema,
} from '@huddle/contracts';

function offers(setting: GameSetting, value: string): boolean {
  return setting.options.some((option) => option.value === value);
}

export function settingsFrom(
  schema: GameSettingsSchema,
  chosen: GameSettings | undefined,
): GameSettings {
  return Object.fromEntries(
    schema.map((setting) => {
      const value = chosen?.[setting.key];

      return [
        setting.key,
        value !== undefined && offers(setting, value) ? value : setting.defaultValue,
      ];
    }),
  );
}

export function settingsRefusal(
  schema: GameSettingsSchema,
  chosen: GameSettings | undefined,
): GameLifecycleRejection | null {
  for (const [key, value] of Object.entries(chosen ?? {})) {
    const setting = schema.find((declared) => declared.key === key);

    if (setting === undefined || !offers(setting, value)) {
      return { kind: 'settingRejected', key, value };
    }
  }

  return null;
}

export function settingsRefusalForMode(
  schema: GameSettingsSchema,
  presentation: GameSettingsPresentation | undefined,
  chosen: GameSettings | undefined,
  mode: GameSettingsMode | undefined,
): GameLifecycleRejection | null {
  const genericRefusal = settingsRefusal(schema, chosen);
  if (genericRefusal !== null || presentation === undefined || mode === undefined) {
    return genericRefusal;
  }

  const settled = settingsFrom(schema, chosen);

  if (mode === 'custom') {
    for (const setting of schema) {
      const value = settled[setting.key] ?? setting.defaultValue;
      const customKeys = presentation.customSettingKeys;

      if (customKeys !== undefined && !customKeys.includes(setting.key)) {
        if (value !== setting.defaultValue) {
          return { kind: 'settingRejected', key: setting.key, value };
        }
        continue;
      }

      const allowed = presentation.customOptions?.[setting.key];
      if (allowed !== undefined && !allowed.includes(value)) {
        return { kind: 'settingRejected', key: setting.key, value };
      }
    }

    return null;
  }

  const preset = presentation.presets?.find((candidate) => candidate.mode === mode);
  if (preset === undefined) return null;

  const expected = settingsFrom(schema, preset.settings);
  for (const setting of schema) {
    const value = settled[setting.key] ?? setting.defaultValue;
    if (value !== expected[setting.key]) {
      return { kind: 'settingRejected', key: setting.key, value };
    }
  }

  return null;
}

export type SettingSummary = {
  readonly value: string;
  readonly unit?: string;
};

export function settingSummary(setting: GameSetting, value: string | undefined): SettingSummary {
  const chosen = value ?? setting.defaultValue;
  const option = setting.options.find((candidate) => candidate.value === chosen);
  if (option === undefined) return { value: chosen };
  const unit = option.unit ?? setting.unit;
  return unit === undefined ? { value: option.short ?? option.label } : { value: option.short ?? option.label, unit };
}

export function settingOptionLabel(setting: GameSetting, value: string | undefined): string {
  const chosen = value ?? setting.defaultValue;
  return setting.options.find((candidate) => candidate.value === chosen)?.label ?? chosen;
}

export function settingSummaryText(setting: GameSetting, value: string | undefined): string {
  const summary = settingSummary(setting, value);
  return summary.unit === undefined ? summary.value : `${summary.value} ${summary.unit}`;
}
