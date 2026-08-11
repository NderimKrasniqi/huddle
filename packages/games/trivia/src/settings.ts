import { type GameSettings, type GameSettingsSchema, settingsFrom } from '@huddle/game-core';

// The category names and the "no filter" sentinel, from the pack's client-safe
// entry — pointedly not `./questions`, which imports `CURATED_PACK` and would
// pull every answer into the Controller bundle (docs/implementation-plan.md
// 5.9). The Host filters by a category *name*, and a name is not an answer, so
// the names may ship where the questions may not. `EVERY_CATEGORY` keeps its
// trivia-side name for the rest of this file; it is the pack's own reserved word.
import {
  CURATED_CATEGORIES as PACK_CATEGORIES,
  RESERVED_CATEGORY as EVERY_CATEGORY,
} from '@huddle/packs/categories';

/**
 * Trivia's host-tunable options: what the Host is offered, and what trivia makes
 * of their answers.
 *
 * The declaration is data, and that is the whole point of it — the hub validates
 * it, defaults it and (in the settings screen) draws it without knowing that
 * "questionCount" is a number of questions or that "Movies" is a category. So
 * everything trivia knows about its own settings is in this file, on the far
 * side of a schema the hub reads as labelled strings.
 */

/** How a correct answer scores (the Scoring Mode). */
export const SCORING_MODES = ['flat', 'speed'] as const;

export type ScoringMode = (typeof SCORING_MODES)[number];

/** How many questions a game runs. */
export const QUESTION_COUNTS = [5, 10, 15, 20] as const;

export type QuestionCount = (typeof QUESTION_COUNTS)[number];

const SCORING_KEY = 'scoring';
const QUESTION_COUNT_KEY = 'questionCount';
const DIFFICULTY_KEY = 'difficulty';
const QUESTION_SECONDS_KEY = 'questionSeconds';
const CATEGORY_KEY = 'category';

const DEFAULT_SCORING: ScoringMode = 'flat';
const DEFAULT_QUESTION_COUNT: QuestionCount = 10;
const DEFAULT_DIFFICULTY: Difficulty = 'mixed';
const DEFAULT_QUESTION_SECONDS: QuestionSeconds = 20;

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'mixed'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const QUESTION_SECONDS_OPTIONS = [10, 15, 20, 30] as const;
export type QuestionSeconds = (typeof QUESTION_SECONDS_OPTIONS)[number];

/**
 * What the Host may choose before a game of trivia starts.
 *
 * Every option is a value the hub will hand back untouched and a label nobody
 * but a person reads. The category list is the one that is *derived*: its
 * options are whatever categories the pack turns out to use, so a themed pack
 * shipping tomorrow gains its filters without a line changing here.
 */
export const TRIVIA_SETTINGS_SCHEMA: GameSettingsSchema = [
  // Kept in the server schema so legacy Speed clients and persisted drafts can
  // still be decoded. The new setup presentation intentionally hides it.
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

/** The settings above, as trivia's own rules need them. */
export type TriviaSettings = {
  readonly scoring: ScoringMode;
  readonly questionCount: QuestionCount;
  readonly difficulty?: Difficulty;
  readonly questionSeconds?: QuestionSeconds;
  /** `EVERY_CATEGORY`, or one of the pack's own. */
  readonly category: string;
};

function scoringMode(value: string | undefined): ScoringMode {
  return SCORING_MODES.find((mode) => mode === value) ?? DEFAULT_SCORING;
}

function questionCount(value: string | undefined): QuestionCount {
  return QUESTION_COUNTS.find((count) => String(count) === value) ?? DEFAULT_QUESTION_COUNT;
}

function difficulty(value: string | undefined): Difficulty {
  return DIFFICULTIES.find((candidate) => candidate === value) ?? DEFAULT_DIFFICULTY;
}

function questionSeconds(value: string | undefined): QuestionSeconds {
  return (
    QUESTION_SECONDS_OPTIONS.find((seconds) => String(seconds) === value) ??
    DEFAULT_QUESTION_SECONDS
  );
}

/**
 * The Host's settings, read as trivia's three.
 *
 * Total, like `settingsFrom` it is built on: a game handed something its schema
 * never offered deals a default rather than throwing inside a mutation. That is
 * a floor nobody stands on — `startGame` refuses those settings before a game is
 * seeded from them — and it is what makes this function's return type honest,
 * since `GameSettings` is strings and `TriviaSettings` is not.
 */
export function triviaSettings(chosen: GameSettings | undefined): TriviaSettings {
  const settled = settingsFrom(TRIVIA_SETTINGS_SCHEMA, chosen);
  const modernDraft =
    chosen !== undefined &&
    chosen[SCORING_KEY] !== 'speed' &&
    (Object.hasOwn(chosen, DIFFICULTY_KEY) || Object.hasOwn(chosen, QUESTION_SECONDS_KEY));
  const settings: TriviaSettings = {
    scoring: scoringMode(settled[SCORING_KEY]),
    questionCount: questionCount(settled[QUESTION_COUNT_KEY]),
    category: settled[CATEGORY_KEY] ?? EVERY_CATEGORY,
  };

  if (modernDraft) {
    return {
      ...settings,
      difficulty: difficulty(settled[DIFFICULTY_KEY]),
      questionSeconds: questionSeconds(settled[QUESTION_SECONDS_KEY]),
    };
  }

  return settings;
}

/** Generic setup copy for the Host phone and the TV Game Setup canvas. */
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
