import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * 5.9's seam, guarded at the one place the other checks could not see it.
 *
 * The Question Pack stays out of the client bundle only while the files a client
 * bundles reach `./logic` — which deals from the pack — through *types alone*.
 * The catch is that `export { type X } from './logic'` (the value-block form
 * with an inline `type`) keeps the module edge and pulls the whole of `./logic`,
 * and the pack behind it, into the bundle — while `export type { X }` erases the
 * statement whole. The two are identical to the type-checker, the linter, and
 * every runtime test, so a regression from one to the other passes all of them
 * and silently re-ships every answer. Only a bundler sees the difference (the
 * end-to-end proof is the esbuild graph recorded on the PR); this is the fast
 * tripwire that fails in-repo.
 *
 * The rule it enforces: in the client entry (`./index`) and the client module
 * (`./trivia`), any `import`/`export … from './logic'` or './questions' must be
 * the type-only form (`import type` / `export type`). A value-block edge to
 * either is the leak.
 */
function source(file: string): string {
  return readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');
}

describe('the trivia client entry keeps the pack at arm’s length', () => {
  it.each(['./index.ts', './trivia.ts'])(
    '%s reaches ./logic and ./questions through types only',
    (file) => {
      const text = source(file);

      // A value-block edge is `import {…}`/`export {…}` (no `type` before the
      // brace) from ./logic or ./questions. The type-only forms — `import type
      // {…}` / `export type {…}` — do not match, and are the only ones allowed.
      const valueEdges = [
        ...text.matchAll(/^(?:import|export)\s+\{[^}]*\}\s+from\s+'\.\/(?:logic|questions)'/gm),
      ].map((match) => match[0]);

      expect(valueEdges).toEqual([]);
    },
  );
});
