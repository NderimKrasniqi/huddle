import { z } from 'zod';

import { RESERVED_CATEGORY } from './category-contract';

export { RESERVED_CATEGORY } from './category-contract';

const nonEmpty = z.string().min(1);

const optionsSchema = z.tuple([nonEmpty, nonEmpty, nonEmpty, nonEmpty]);

export const QUESTION_OPTION_COUNT: z.infer<typeof optionsSchema>['length'] = 4;

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

const packIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a lowercase slug, e.g. "huddle-classics"');

export const packQuestionSchema = z
  .strictObject({
    text: nonEmpty,
    options: optionsSchema,
    correctIndex: z
      .number()
      .int()
      .min(0)
      .max(QUESTION_OPTION_COUNT - 1),
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
