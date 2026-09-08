import { z } from 'zod';

const playerIdSchema = z.string().min(1);
const awayPlayerIdsSchema = z.array(playerIdSchema);

const triviaQuestionSchema = z.strictObject({
  text: z.string(),
  options: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  // -2 is the redacted correct-answer sentinel used by client projections.
  correctIndex: z.number().int().min(-2).max(3).refine((value) => value !== -1),
});

const legacyTriviaStateSchema = z.strictObject({
  phase: z.literal('entered'),
  resolvedSettings: z.strictObject({
    questions: z.union([z.literal(5), z.literal(10)]),
  }),
});

const playableTriviaStateSchema = z.strictObject({
  questions: z.array(triviaQuestionSchema).min(1),
  questionIndex: z.number().int().nonnegative(),
  phase: z.enum(['intro', 'question', 'reveal', 'finished']),
  answers: z.record(playerIdSchema, z.number().int().min(0).max(3)),
  answerSeconds: z.record(playerIdSchema, z.number().finite().nonnegative()).optional(),
  // TV-only live aggregate; no player ids or answer timing cross the seam.
  participationCount: z.number().int().nonnegative().optional(),
  // TV reveal projection: normalized outcome only, never an option mapping.
  revealVerdicts: z.record(playerIdSchema, z.boolean()).optional(),
  questionSeconds: z.number().int().min(10).max(30).optional(),
  standings: z.array(
    z.strictObject({ playerId: playerIdSchema, score: z.number().finite() }),
  ),
  scoring: z.enum(['flat', 'speed']).optional(),
});

/** Strict v2 decoder: old launch-proof rooms and new playable rooms coexist. */
export const triviaStateSchema = z.union([
  legacyTriviaStateSchema,
  playableTriviaStateSchema,
]);

const triviaAnswerEventSchema = z.strictObject({
  kind: z.literal('answer'),
  playerId: playerIdSchema,
  questionIndex: z.number().int().nonnegative(),
  optionIndex: z.number().int().min(0).max(3),
  msRemaining: z.number().finite().optional(),
  awayPlayerIds: awayPlayerIdsSchema.optional(),
});

const triviaAdvanceEventSchema = z.strictObject({
  kind: z.literal('advance'),
  playerId: playerIdSchema.optional(),
  questionIndex: z.number().int().nonnegative(),
  phase: z.enum(['intro', 'question', 'reveal', 'finished']),
  msRemaining: z.number().finite().optional(),
  awayPlayerIds: awayPlayerIdsSchema.optional(),
});

/** Strict decoder for untrusted Trivia events, including server deadlines. */
export const triviaEventSchema = z.union([
  triviaAnswerEventSchema,
  triviaAdvanceEventSchema,
]);
