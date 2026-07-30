import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as packs from './index';

const here = dirname(fileURLToPath(import.meta.url));

/** Every module the package's public entry point reaches, following relative imports. */
function reachableFromIndex(): Map<string, string> {
  const reached = new Map<string, string>();
  const pending = ['index.ts'];

  while (pending.length > 0) {
    const name = pending.pop();

    if (name === undefined || reached.has(name)) {
      continue;
    }

    const source = readFileSync(join(here, name), 'utf8');
    reached.set(name, source);

    for (const [, specifier] of source.matchAll(/from '\.\/([\w-]+)'/g)) {
      pending.push(`${specifier}.ts`);
    }
  }

  return reached;
}

/**
 * The seam this package holds: `@huddle/packs` is imported by both apps, and
 * Pack Validation reads a directory — `node:fs`, which Metro has no answer for.
 *
 * Written as a test rather than trusted to the comment on the export list,
 * because the failure it prevents surfaces as a broken app build saying nothing
 * about packs. A *source* check like the Registry's (`logic.test.ts`): it reads
 * the import graph rather than bundling it.
 */
describe('the public entry point', () => {
  it('never reaches a Node built-in', () => {
    const reached = reachableFromIndex();
    // Without this the guard passes vacuously if the walk ever stops working.
    expect([...reached.keys()]).toContain('curated-pack.ts');

    for (const [name, source] of reached) {
      expect([...source.matchAll(/from '(node:[\w/]+)'/g)].map(([, module]) => module), name).toEqual(
        [],
      );
    }
  });

  it('exports the format and the pack, and nothing that validates files', () => {
    // Types are erased, so this is the runtime surface: the schema, the
    // constants, and the curated pack.
    expect(Object.keys(packs).sort()).toEqual([
      'CURATED_PACK',
      'DIFFICULTIES',
      'QUESTION_OPTION_COUNT',
      'packQuestionSchema',
      'questionPackSchema',
    ]);
  });
});
