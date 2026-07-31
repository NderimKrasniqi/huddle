import { type GameSettings, type GameSettingsSchema, settingsFrom } from '@huddle/game-core';

/**
 * The Host's settings while they are still choosing them: what the controls
 * draw, what a tap on one produces, and what the room would start on right now.
 *
 * Nothing here reads a setting. A Settings Schema is a labelled key with a
 * closed list of labelled values (docs/CONTEXT.md), so "which chip is lit" and
 * "what would be sent" are both answerable by comparing strings — which is what
 * lets one screen draw whatever the chosen game declares without knowing what
 * any of it means.
 *
 * The choice lives on the Host's phone and nowhere else. It is not on the room
 * beside `browsingGameIndex` on purpose: the carousel is a shared surface that
 * three screens read, and settings are the opposite — a phone that is not
 * running the room has no settings to draw, rather than settings it is trusted
 * not to draw. What reaches the room is the one `startGame` argument, and that
 * mutation is Host-only (`roomThisPhoneRuns`), so the refusal underneath this
 * screen is what actually keeps a non-Host from setting anything.
 */

/** What the Host has picked, and the card they picked it on. */
export type SettingsChoice = {
  /** `GameMetadata.id` of the game these settings were chosen for. */
  readonly gameId: string;
  /** Only the settings actually touched; the rest default at `settingsFrom`. */
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
): readonly SettingControl[] {
  const starting = settingsToStart(schema, gameId, choice);

  return schema.map((setting) => ({
    key: setting.key,
    label: setting.label,
    options: setting.options.map((option) => ({
      value: option.value,
      label: option.label,
      chosen: starting[setting.key] === option.value,
    })),
  }));
}
