import { z } from 'zod';

import { RESERVED_CATEGORY } from './category-contract';

export { RESERVED_CATEGORY } from './category-contract';

/**
 * The Question Pack format: the only way trivia gets content, and the shape
 * every future source of questions (an Open Trivia DB import, an AI-generated
 * themed pack, a pack somebody writes by hand) has to emit.
 *
 * It is written as a Zod schema rather than a TypeScript type because a pack is
 * a data file, and a data file is only ever as good as what checks it. The
 * schema is one source of truth for both halves of that: `QuestionPack` is
 * inferred from it, so nothing can be added to the format in types without
 * being added to the validation that makes it true.
 */

const nonEmpty = z.string().min(1);

/**
 * The options a question offers — the TV's layout and the phone's four buttons.
 *
 * A tuple rather than a list with a length rule: a question offering three is
 * unplayable on both screens, so a pack holding one is malformed rather than
 * merely unusual.
 */
const optionsSchema = z.tuple([nonEmpty, nonEmpty, nonEmpty, nonEmpty]);

/**
 * The same four, as a number the rest of the format can do arithmetic with.
 *
 * Typed *by* the tuple rather than merely written beside it: the count and the
 * shape are one fact, and this annotation is what makes them disagreeing a
 * compile error. Written as a plain `= 4` it was only a comment, and widening
 * the tuple would have left `correctIndex` bounded to fewer options than a
 * question now offers.
 */
export const QUESTION_OPTION_COUNT: z.infer<typeof optionsSchema>['length'] = 4;

/** How hard a question is meant to be. */
export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

/**
 * A pack's id, which names it wherever a pack is referred to — including the
 * file it ships as — so it is a lowercase slug rather than prose.
 */
const packIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a lowercase slug, e.g. "huddle-classics"');

/**
 * One question as a pack holds it: what trivia's rules need to ask it, plus the
 * two fields only a pack has a use for — the category the Host's filter reads,
 * and the difficulty an author sorts by.
 */
export const packQuestionSchema = z
  .strictObject({
    text: nonEmpty,
    options: optionsSchema,
    /** Which of `options` is right — one of them, and only one. */
    correctIndex: z
      .number()
      .int()
      .min(0)
      .max(QUESTION_OPTION_COUNT - 1),
    /** Free text, because the Host's category filter is built from whatever a pack uses. */
    category: nonEmpty.refine(
      (category) => category.trim().toLowerCase() !== RESERVED_CATEGORY,
      `"${RESERVED_CATEGORY}" is reserved: it is the category filter set to no filter`,
    ),
    difficulty: z.enum(DIFFICULTIES),
  })
  .refine((question) => new Set(question.options).size === question.options.length, {
    error: 'options must all differ — two of these are the same answer',
    path: ['options'],
  });

export const questionPackSchema = z
  .strictObject({
    id: packIdSchema,
    title: nonEmpty,
    /**
     * The pack's own content version, bumped whenever its questions change.
     * A whole number: there is no compatibility story to tell yet, only "this
     * is a later edit of that pack".
     */
    version: z.number().int().positive(),
    questions: z.array(packQuestionSchema).min(1),
  })
  .refine(
    (pack) => new Set(pack.questions.map((question) => question.text)).size === pack.questions.length,
    {
      error: 'two questions ask the same thing',
      path: ['questions'],
    },
  );

export type PackQuestion = z.infer<typeof packQuestionSchema>;

export type QuestionPack = z.infer<typeof questionPackSchema>;
