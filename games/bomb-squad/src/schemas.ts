import { z } from 'zod';

import { WIRES } from './types';

const playerIdSchema = z.string().min(1);
const wireSchema = z.enum(WIRES);

const clueSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('not'), wire: wireSchema }),
  z.strictObject({ kind: z.literal('tone'), tone: z.enum(['warm', 'cool']) }),
  z.strictObject({ kind: z.literal('side'), side: z.enum(['left', 'right']) }),
  z.strictObject({ kind: z.literal('nextTo'), wire: wireSchema }),
]);

const phaseSchema = z.enum(['howTo', 'brief', 'debate', 'cut', 'accuse', 'reveal', 'finished']);

export const bombStateSchema = z.strictObject({
  phase: phaseSchema,
  round: z.number().int().nonnegative(),
  rounds: z.array(
    z.strictObject({
      safe: wireSchema.optional(),
      saboteurs: z.array(playerIdSchema),
      clues: z.record(playerIdSchema, clueSchema),
      tieOrder: z.array(wireSchema).length(WIRES.length).optional(),
    }),
  ),
  roundCount: z.number().int().min(1).max(10),
  votes: z.record(playerIdSchema, wireSchema),
  accusations: z.record(playerIdSchema, playerIdSchema),
  gotIt: z.array(playerIdSchema).optional(),
  debateSeconds: z.number().int().min(10).max(120),
  standings: z.array(z.strictObject({ playerId: playerIdSchema, score: z.number().finite() })),
  results: z.array(
    z.strictObject({
      cut: wireSchema.nullable(),
      tied: z.boolean().optional(),
      defused: z.boolean(),
      gains: z.record(playerIdSchema, z.number().finite()),
    }),
  ),
  votedCount: z.number().int().nonnegative().optional(),
});

const eventBase = {
  playerId: playerIdSchema.optional(),
  fromHost: z.boolean().optional(),
  msRemaining: z.number().finite().optional(),
  awayPlayerIds: z.array(playerIdSchema).optional(),
};

export const bombEventSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...eventBase, kind: z.literal('vote'), round: z.number().int().nonnegative(), wire: wireSchema }),
  z.strictObject({ ...eventBase, kind: z.literal('gotIt') }),
  z.strictObject({ ...eventBase, kind: z.literal('accuse'), round: z.number().int().nonnegative(), suspect: playerIdSchema }),
  z.strictObject({ ...eventBase, kind: z.literal('advance'), round: z.number().int().nonnegative(), phase: phaseSchema }),
]);
