import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';

import schema from './schema';

// pnpm's isolated node_modules layout defeats convex-test's default module
// lookup, so hand it the function modules explicitly. The exclusions mirror
// Convex's own entry-point rule: declarations and tests are not functions.
const modules = import.meta.glob(['./**/*.*s', '!./**/*.d.ts', '!./**/*.test.*']);

test('the in-memory Convex backend boots against the schema', async () => {
  const t = convexTest(schema, modules);

  await t.run(async (ctx) => {
    expect(await ctx.db.system.query('_storage').collect()).toEqual([]);
  });
});
