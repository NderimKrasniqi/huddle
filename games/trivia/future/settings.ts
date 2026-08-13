import { type GameSettings, type GameSettingsSchema, settingsFrom } from '@huddle/domain';

import {
  CURATED_CATEGORIES as PACK_CATEGORIES,
  RESERVED_CATEGORY as EVERY_CATEGORY,
} from './content/categories';

export const SCORING_MODES = ['flat', 'speed'] as const;
export type ScoringMode = (typeof SCORING_MODES)[number];

export const QUESTION_COUNTS = [5, 10, 15, 20] as const;
export type QuestionCount = (typeof QUESTION_COUNTS)[number];

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'mixed'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const QUESTION_SECONDS_OPTIONS = [10, 15, 20, 30] as const;
export type QuestionSeconds = (typeof QUESTION_SECONDS_OPTIONS)[number];

const SCORING_KEY = 'scoring';
const QUESTION_COUNT_KEY = 'questionCount';
const DIFFICULTY_KEY = 'difficulty';
const QUESTION_SECONDS_KEY = 'questionSeconds';
const CATEGORY_KEY = 'category';

const DEFAULT_SCORING: ScoringMode = 'flat';
const DEFAULT_QUESTION_COUNT: QuestionCount = 10;
const DEFAULT_DIFFICULTY: Difficulty = 'mixed';
const DEFAULT_QUESTION_SECONDS: QuestionSeconds = 20;

export const TRIVIA_SETTINGS_SCHEMA: GameSettingsSchema = [
  {
    key: SCORING_KEY,
    label: 'Scoring',
    options: [
      { value: 'flat', label: 'Flat — 100 a question' },
      { value: 'speed', label: 'Speed — quicker is worth more' },
    ],
    defaultValue: DEFAULT_SCORING,
  },
  {
    key: QUESTION_COUNT_KEY,
    label: 'Questions',
    options: QUESTION_COUNTS.map((count) => ({ value: String(count), label: String(count) })),
    defaultValue: String(DEFAULT_QUESTION_COUNT),
  },
  {
    key: DIFFICULTY_KEY,
    label: 'Difficulty',
    options: DIFFICULTIES.map((difficulty) => ({
      value: difficulty,
      label: difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
    })),
    defaultValue: DEFAULT_DIFFICULTY,
  },
  {
    key: QUESTION_SECONDS_KEY,
    label: 'Time per question',
    options: QUESTION_SECONDS_OPTIONS.map((seconds) => ({
      value: String(seconds),
      label: `${seconds} sec`,
    })),
    defaultValue: String(DEFAULT_QUESTION_SECONDS),
  },
  {
    key: CATEGORY_KEY,
    label: 'Category',
    options: [
      { value: EVERY_CATEGORY, label: 'All categories' },
      ...PACK_CATEGORIES.map((category) => ({ value: category, label: category })),
    ],
    defaultValue: EVERY_CATEGORY,
  },
];

export type TriviaSettings = {
  readonly scoring: ScoringMode;
  readonly questionCount: QuestionCount;
  readonly difficulty?: Difficulty;
  readonly questionSeconds?: QuestionSeconds;
  readonly category: string;
};

function oneOf<const T extends readonly string[]>(
  values: T,
  value: string | undefined,
  fallback: T[number],
): T[number] {
  return values.find((candidate) => candidate === value) ?? fallback;
}

function questionCount(value: string | undefined): QuestionCount {
  return QUESTION_COUNTS.find((count) => String(count) === value) ?? DEFAULT_QUESTION_COUNT;
}

function questionSeconds(value: string | undefined): QuestionSeconds {
  return (
    QUESTION_SECONDS_OPTIONS.find((seconds) => String(seconds) === value) ??
    DEFAULT_QUESTION_SECONDS
  );
}

export function triviaSettings(chosen: GameSettings | undefined): TriviaSettings {
  const settled = settingsFrom(TRIVIA_SETTINGS_SCHEMA, chosen);
  const modernDraft =
    chosen !== undefined &&
    chosen[SCORING_KEY] !== 'speed' &&
    (Object.hasOwn(chosen, DIFFICULTY_KEY) || Object.hasOwn(chosen, QUESTION_SECONDS_KEY));
  const base: TriviaSettings = {
    scoring: oneOf(SCORING_MODES, settled[SCORING_KEY], DEFAULT_SCORING),
    questionCount: questionCount(settled[QUESTION_COUNT_KEY]),
    category: settled[CATEGORY_KEY] ?? EVERY_CATEGORY,
  };

  return modernDraft
    ? {
        ...base,
        difficulty: oneOf(DIFFICULTIES, settled[DIFFICULTY_KEY], DEFAULT_DIFFICULTY),
        questionSeconds: questionSeconds(settled[QUESTION_SECONDS_KEY]),
      }
    : base;
}

export const TRIVIA_SETTINGS_PRESENTATION = {
  presets: [
    {
      mode: 'quick' as const,
      label: 'Quick',
      settings: {
        scoring: 'flat',
        questionCount: '5',
        difficulty: 'mixed',
        questionSeconds: '15',
        category: EVERY_CATEGORY,
      },
    },
    {
      mode: 'standard' as const,
      label: 'Standard',
      settings: {
        scoring: 'flat',
        questionCount: '10',
        difficulty: 'mixed',
        questionSeconds: '20',
        category: EVERY_CATEGORY,
      },
    },
  ],
  customSettingKeys: [QUESTION_COUNT_KEY, DIFFICULTY_KEY, QUESTION_SECONDS_KEY, CATEGORY_KEY],
  customOptions: { [QUESTION_SECONDS_KEY]: ['10', '20', '30'] },
} as const;
