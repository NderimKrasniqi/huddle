import { z } from 'zod';

const playerIdSchema = z.string().min(1);
const awayPlayerIdsSchema = z.array(playerIdSchema);
const triviaQuestionSchema = z.strictObject({
  text: z.string(),
  options: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  // -2 is the redacted correct-answer sentinel used by the client projection.
  correctIndex: z.number().int().min(-2).max(3).refine((value) => value !== -1),
});

/** Strict server-side decoder for persisted Trivia state. */
export const triviaStateSchema = z.strictObject({
  questions: z.array(triviaQuestionSchema).min(1),
  questionIndex: z.number().int().nonnegative(),
  phase: z.enum(['question', 'reveal', 'finished']),
  // -1 is the redacted answer sentinel; the server's stored state only has 0–3.
  answers: z.record(playerIdSchema, z.number().int().min(-1).max(3)),
  answerSeconds: z.record(playerIdSchema, z.number().finite().nonnegative()).optional(),
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
  msRemaining: z.number().finite().nonnegative().optional(),
  awayPlayerIds: awayPlayerIdsSchema.optional(),
});

const triviaAdvanceEventSchema = z.strictObject({
  kind: z.literal('advance'),
  playerId: playerIdSchema.optional(),
  questionIndex: z.number().int().nonnegative(),
  phase: z.enum(['question', 'reveal', 'finished']),
  msRemaining: z.number().finite().nonnegative().optional(),
  awayPlayerIds: awayPlayerIdsSchema.optional(),
});

/** Strict server-side decoder for untrusted Trivia events. */
export const triviaEventSchema = z.union([triviaAnswerEventSchema, triviaAdvanceEventSchema]);
