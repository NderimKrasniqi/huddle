import type {
  GameSetting,
  GameSettingsMode,
  GameSettingsPresentation,
  GameSettingsSchema,
} from './game-module';
import type { GameLifecycleRejection } from './room-phase';

/**
 * The Host's settings, as everything outside a game module holds them: a value
 * per key, both of them strings, and neither of them anything the hub reads.
 *
 * A game's own settings type is its business — trivia turns this into a scoring
 * mode, a count and a category — but the room stores what the Host chose, the
 * mutation validates it, and the settings screen draws it, and all three do that
 * without knowing what any of it means. So this is the shape they share: a
 * Settings Schema's keys against the values it offers for them, which is exactly
 * what a closed list of labelled options can produce.
 */
export type GameSettings = Readonly<Record<string, string>>;

/** Whether this setting offers that value — the whole of what "valid" means. */
function offers(setting: GameSetting, value: string): boolean {
  return setting.options.some((option) => option.value === value);
}

/**
 * The settings a game is started with: what the Host chose, and the schema's own
 * default for everything they did not.
 *
 * Total, on purpose. Every setting declares a default among its options
 * (`GameSetting`), so a schema always answers this — which is what lets a Host
 * start a game without opening the settings screen at all, and what keeps a
 * module from ever being handed a setting it did not declare. A value the schema
 * does not offer defaults rather than throwing; the refusal below is where a
 * Host hears about that, and this stays the function that cannot fail.
 */
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

/**
 * Why the game may not be started on these settings, or `null` if it may.
 *
 * The hub's whole part in validating settings, and it does it generically: a
 * schema is a closed list of labelled values, so "does the declaring game accept
 * this" is answerable without knowing what any of the values mean. Trivia never
 * validates its own settings, and no game has to.
 *
 * It refuses rather than quietly defaulting because a Host who chose something
 * the room cannot honour should not be handed a game that ignored them —
 * `settingsFrom` is total so that a *start that was allowed* can never be
 * short a setting, not so that a rejected choice can pass as an accepted one.
 */
export function settingsRefusal(
  schema: GameSettingsSchema,
  chosen: GameSettings | undefined,
): GameLifecycleRejection | null {
  for (const [key, value] of Object.entries(chosen ?? {})) {
    const setting = schema.find((declared) => declared.key === key);

    // Both failures are one refusal: a key the game never declared and a value
    // it does not offer are the same mistake to the Host — a phone sending
    // settings for a game it does not have this build of — and neither is
    // reachable from a settings screen drawn off this schema.
    if (setting === undefined || !offers(setting, value)) {
      return { kind: 'settingRejected', key, value };
    }
  }

  return null;
}

/**
 * Refuse a setting that is valid in the broad schema but not in the selected
 * setup mode. Presentation data is still module-owned; this helper only
 * applies its closed option lists at the server boundary so a modified client
 * cannot bypass the generic setup shell.
 */
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

      // A setting hidden from the custom shell stays at its module default.
      // This is what lets Trivia keep legacy scoring in its schema while all
      // newly selectable modes remain flat-scored.
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
