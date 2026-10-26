import { z } from 'zod';

const playerIdSchema = z.string().min(1);
const awayPlayerIdsSchema = z.array(playerIdSchema);

const triviaQuestionSchema = z.strictObject({
  text: z.string(),
  options: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  correctIndex: z.number().int().min(-2).max(3).refine((value) => value !== -1),
  category: z.string().optional(),
});

export const triviaStateSchema = z.strictObject({
  questions: z.array(triviaQuestionSchema).min(1),
  questionIndex: z.number().int().nonnegative(),
  phase: z.enum(['intro', 'question', 'reveal', 'finished']),
  answers: z.record(playerIdSchema, z.number().int().min(0).max(3)),
  answerSeconds: z.record(playerIdSchema, z.number().finite().nonnegative()).optional(),
  participationCount: z.number().int().nonnegative().optional(),
  revealVerdicts: z.record(playerIdSchema, z.boolean()).optional(),
  revealAnswered: z.record(playerIdSchema, z.boolean()).optional(),
  revealGains: z.record(playerIdSchema, z.number().finite()).optional(),
  questionSeconds: z.number().int().min(10).max(30).optional(),
  standings: z.array(
    z.strictObject({ playerId: playerIdSchema, score: z.number().finite() }),
  ),
  scoring: z.enum(['flat', 'speed']).optional(),
});

const triviaAnswerEventSchema = z.strictObject({
  kind: z.literal('answer'),
  playerId: playerIdSchema,
  questionIndex: z.number().int().nonnegative(),
  optionIndex: z.number().int().min(0).max(3),
  msRemaining: z.number().finite().optional(),
  awayPlayerIds: awayPlayerIdsSchema.optional(),
  fromHost: z.boolean().optional(),
});

const triviaAdvanceEventSchema = z.strictObject({
  kind: z.literal('advance'),
  playerId: playerIdSchema.optional(),
  questionIndex: z.number().int().nonnegative(),
  phase: z.enum(['intro', 'question', 'reveal', 'finished']),
  msRemaining: z.number().finite().optional(),
  awayPlayerIds: awayPlayerIdsSchema.optional(),
  fromHost: z.boolean().optional(),
});

export const triviaEventSchema = z.union([
  triviaAnswerEventSchema,
  triviaAdvanceEventSchema,
]);
