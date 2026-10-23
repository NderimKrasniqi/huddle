import { z } from 'zod';

const playerIdSchema = z.string().min(1);
const pointSchema = z.strictObject({ x: z.number().finite(), y: z.number().finite() });
const aimSchema = z.strictObject({ dx: z.number().finite(), dy: z.number().finite() });
const phaseSchema = z.enum(['howTo', 'aim', 'replay', 'matchOver', 'finished']);

export const sumoStateSchema = z.strictObject({
  phase: phaseSchema,
  match: z.number().int().nonnegative(),
  matchCount: z.number().int().min(1).max(10),
  round: z.number().int().nonnegative(),
  arenaRadius: z.number().positive(),
  aimSeconds: z.number().int().min(3).max(60),
  blobs: z.record(playerIdSchema, z.strictObject({ x: z.number().finite(), y: z.number().finite(), alive: z.boolean() })),
  aims: z.record(playerIdSchema, aimSchema),
  lastRound: z
    .strictObject({
      start: z.record(playerIdSchema, pointSchema),
      aims: z.record(playerIdSchema, aimSchema),
      final: z.record(playerIdSchema, pointSchema),
      arenaRadius: z.number().positive(),
      knockedOut: z.array(playerIdSchema),
      knockouts: z.array(z.strictObject({ out: playerIdSchema, by: playerIdSchema.optional(), byGhost: z.boolean() })),
    })
    .optional(),
  matchWinners: z.array(playerIdSchema.nullable()),
  standings: z.array(z.strictObject({ playerId: playerIdSchema, score: z.number().finite() })),
  gotIt: z.array(playerIdSchema).optional(),
  aimedCount: z.number().int().nonnegative().optional(),
});

const eventBase = {
  playerId: playerIdSchema.optional(),
  fromHost: z.boolean().optional(),
  msRemaining: z.number().finite().optional(),
  awayPlayerIds: z.array(playerIdSchema).optional(),
};

export const sumoEventSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...eventBase, kind: z.literal('aim'), match: z.number().int().nonnegative(), round: z.number().int().nonnegative(), dx: z.number().finite(), dy: z.number().finite() }),
  z.strictObject({ ...eventBase, kind: z.literal('gotIt') }),
  z.strictObject({ ...eventBase, kind: z.literal('advance'), match: z.number().int().nonnegative(), round: z.number().int().nonnegative(), phase: phaseSchema }),
]);
