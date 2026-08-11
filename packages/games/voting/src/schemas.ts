import { z } from 'zod';

const playerIdSchema = z.string().min(1);
const votingPromptSchema = z.strictObject({
  text: z.string(),
  options: z.array(z.string()).min(2).max(4),
});

/** Strict server-side decoder for persisted Voting state. */
export const votingStateSchema = z.strictObject({
  prompts: z.array(votingPromptSchema).min(1),
  promptIndex: z.number().int().nonnegative(),
  phase: z.enum(['voting', 'reveal', 'finished']),
  voters: z.array(playerIdSchema),
  tally: z.array(z.number().int().nonnegative()),
  players: z.array(playerIdSchema),
});

const votingVoteEventSchema = z.strictObject({
  kind: z.literal('vote'),
  playerId: playerIdSchema,
  promptIndex: z.number().int().nonnegative(),
  optionIndex: z.number().int().min(0).max(3),
  msRemaining: z.number().finite().nonnegative().optional(),
  awayPlayerIds: z.array(playerIdSchema).optional(),
});

const votingAdvanceEventSchema = z.strictObject({
  kind: z.literal('advance'),
  playerId: playerIdSchema.optional(),
  promptIndex: z.number().int().nonnegative(),
  phase: z.enum(['voting', 'reveal', 'finished']),
  msRemaining: z.number().finite().nonnegative().optional(),
  awayPlayerIds: z.array(playerIdSchema).optional(),
});

/** Strict server-side decoder for untrusted Voting events. */
export const votingEventSchema = z.union([votingVoteEventSchema, votingAdvanceEventSchema]);
