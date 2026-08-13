import { z } from 'zod';
export const votingStateSchema = z.strictObject({ phase: z.literal('entered'), resolvedSettings: z.strictObject({ rounds: z.union([z.literal(3), z.literal(5)]) }) });
