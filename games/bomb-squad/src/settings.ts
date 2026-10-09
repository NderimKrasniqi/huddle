import { type GameSettings, type GameSettingsSchema, settingsFrom } from '@huddle/domain';

const ROUND_COUNTS = [3, 5, 7] as const;
const DEBATE_SECONDS_OPTIONS = [30, 45, 60] as const;

const ROUNDS_KEY = 'rounds';
const DEBATE_KEY = 'debateSeconds';
const DEFAULT_ROUNDS = 5;
const DEFAULT_DEBATE_SECONDS = 45;

export const BOMB_SETTINGS_SCHEMA: GameSettingsSchema = [
  {
    key: ROUNDS_KEY,
    label: 'Bombs',
    icon: 'count',
    unit: 'bombs',
    options: ROUND_COUNTS.map((count) => ({ value: String(count), label: String(count) })),
    defaultValue: String(DEFAULT_ROUNDS),
  },
  {
    key: DEBATE_KEY,
    label: 'Time to argue',
    icon: 'timer',
    unit: 'seconds',
    options: DEBATE_SECONDS_OPTIONS.map((seconds) => ({ value: String(seconds), label: `${seconds} sec`, short: String(seconds) })),
    defaultValue: String(DEFAULT_DEBATE_SECONDS),
  },
];

type BombSettings = { readonly rounds: number; readonly debateSeconds: number };

export function bombSettings(chosen: GameSettings | undefined): BombSettings {
  const settled = settingsFrom(BOMB_SETTINGS_SCHEMA, chosen);
  const rounds = ROUND_COUNTS.find((count) => String(count) === settled[ROUNDS_KEY]) ?? DEFAULT_ROUNDS;
  const debateSeconds =
    DEBATE_SECONDS_OPTIONS.find((seconds) => String(seconds) === settled[DEBATE_KEY]) ?? DEFAULT_DEBATE_SECONDS;
  return { rounds, debateSeconds };
}
