import { type GameSettings, type GameSettingsSchema, settingsFrom } from '@huddle/game-core';

import { EVERY_CATEGORY, PACK_CATEGORIES } from './questions';

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

/** How a correct answer scores (docs/CONTEXT.md: Scoring Mode). */
export const SCORING_MODES = ['flat', 'speed'] as const;

export type ScoringMode = (typeof SCORING_MODES)[number];

/** How many questions a game runs — the plan's three lengths. */
export const QUESTION_COUNTS = [5, 10, 20] as const;

export type QuestionCount = (typeof QUESTION_COUNTS)[number];

const SCORING_KEY = 'scoring';
const QUESTION_COUNT_KEY = 'questionCount';
const CATEGORY_KEY = 'category';

const DEFAULT_SCORING: ScoringMode = 'flat';
const DEFAULT_QUESTION_COUNT: QuestionCount = 10;

/**
 * What the Host may choose before a game of trivia starts.
 *
 * Every option is a value the hub will hand back untouched and a label nobody
 * but a person reads. The category list is the one that is *derived*: its
 * options are whatever categories the pack turns out to use, so a themed pack
 * shipping tomorrow gains its filters without a line changing here.
 */
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
  /** `EVERY_CATEGORY`, or one of the pack's own. */
  readonly category: string;
};

function scoringMode(value: string | undefined): ScoringMode {
  return SCORING_MODES.find((mode) => mode === value) ?? DEFAULT_SCORING;
}

function questionCount(value: string | undefined): QuestionCount {
  return QUESTION_COUNTS.find((count) => String(count) === value) ?? DEFAULT_QUESTION_COUNT;
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

  return {
    scoring: scoringMode(settled[SCORING_KEY]),
    questionCount: questionCount(settled[QUESTION_COUNT_KEY]),
    category: settled[CATEGORY_KEY] ?? EVERY_CATEGORY,
  };
}
