import {
  type GameSettings,
  type GameSettingsPresentation,
  type GameSettingsSchema,
  settingsFrom,
} from '@huddle/game-core';

/**
 * The Host's settings while they are still choosing them: what the controls
 * draw, what a tap on one produces, and what the room would start on right now.
 *
 * Nothing here reads a setting. A Settings Schema is a labelled key with a
 * closed list of labelled values, so "which chip is lit" and
 * "what would be sent" are both answerable by comparing strings — which is what
 * lets one screen draw whatever the chosen game declares without knowing what
 * any of it means.
 *
 * The choice is an optimistic mirror for the Host's picker. The authoritative
 * copy lives in the room's optional setup draft, which `configureGame` updates
 * after each tap and which `startGame` locks atomically. A non-Host never gets
 * this screen, and the Convex mutations remain Host-only, so the local mirror
 * cannot become a second source of truth or a way around authorization.
 */

/** What the Host has picked, and the card they picked it on. */
export type SettingsChoice = {
  /** `GameMetadata.id` of the game these settings were chosen for. */
  readonly gameId: string;
  /** Settings shown while the room draft mutation settles; untouched values default at `settingsFrom`. */
  readonly settings: GameSettings;
};

/**
 * The Host's settings for `gameId`, or `undefined` where they have chosen none
 * for it.
 *
 * A choice belongs to the card it was made on, so browsing to another game
 * leaves it behind rather than carrying it over: schemas do not share keys, and
 * a setting one game declared would be refused by the next one as a
 * `settingRejected`.
 */
function chosenFor(
  gameId: string,
  choice: SettingsChoice | undefined,
): GameSettings | undefined {
  return choice?.gameId === gameId ? choice.settings : undefined;
}

/** The Host picking `value` for `key` on the card they are browsing. */
export function settingChosen(
  gameId: string,
  choice: SettingsChoice | undefined,
  key: string,
  value: string,
): SettingsChoice {
  return { gameId, settings: { ...chosenFor(gameId, choice), [key]: value } };
}

/**
 * The settings the room would start on right now: what the Host chose, settled
 * against the declaring game's schema.
 *
 * Settled here as well as in `startGame` because this is also what the controls
 * light up against — a Host who has touched nothing has to see the schema's own
 * defaults selected, and those defaults are the same ones the room would use.
 */
export function settingsToStart(
  schema: GameSettingsSchema,
  gameId: string,
  choice: SettingsChoice | undefined,
): GameSettings {
  return settingsFrom(schema, chosenFor(gameId, choice));
}

/** One value the Host may pick, and whether it is the one standing. */
export type SettingOptionControl = {
  readonly value: string;
  readonly label: string;
  readonly chosen: boolean;
};

/** One setting as the Host's screen draws it: a label and its options. */
export type SettingControl = {
  readonly key: string;
  readonly label: string;
  readonly options: readonly SettingOptionControl[];
};

/**
 * The controls for the game being browsed: one per setting it declares, in the
 * order it declares them, each with the value the room would start on lit.
 *
 * An empty schema draws nothing, which is a game that declares no settings and
 * not an error — the Host simply starts it.
 */
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
