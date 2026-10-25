import { type GameSettings, type GameSettingsSchema, settingsFrom } from '@huddle/domain';

const MATCH_COUNTS = [1, 3, 5] as const;
const AIM_SECONDS_OPTIONS = [8, 12, 15] as const;
const MATCHES_KEY = 'matches';
const AIM_KEY = 'aimSeconds';
const DEFAULT_MATCHES = 3;
const DEFAULT_AIM_SECONDS = 12;

export const SUMO_SETTINGS_SCHEMA: GameSettingsSchema = [
  {
    key: MATCHES_KEY,
    label: 'Matches',
    icon: 'count',
    unit: 'matches',
    options: MATCH_COUNTS.map((count) => ({ value: String(count), label: String(count) })),
    defaultValue: String(DEFAULT_MATCHES),
  },
  {
    key: AIM_KEY,
    label: 'Time to aim',
    icon: 'timer',
    unit: 'seconds',
    options: AIM_SECONDS_OPTIONS.map((seconds) => ({ value: String(seconds), label: `${seconds} sec`, short: String(seconds) })),
    defaultValue: String(DEFAULT_AIM_SECONDS),
  },
];

export function sumoSettings(chosen: GameSettings | undefined): { readonly matches: number; readonly aimSeconds: number } {
  const settled = settingsFrom(SUMO_SETTINGS_SCHEMA, chosen);
  const matches = MATCH_COUNTS.find((count) => String(count) === settled[MATCHES_KEY]) ?? DEFAULT_MATCHES;
  const aimSeconds = AIM_SECONDS_OPTIONS.find((seconds) => String(seconds) === settled[AIM_KEY]) ?? DEFAULT_AIM_SECONDS;
  return { matches, aimSeconds };
}
