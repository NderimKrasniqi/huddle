import { z } from 'zod';

export const triviaStateSchema = z.strictObject({
  phase: z.literal('entered'),
  resolvedSettings: z.strictObject({ questions: z.union([z.literal(5), z.literal(10)]) }),
});
