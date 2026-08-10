import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * 5.9's seam, guarded at the one place the other checks cannot see it.
 *
 * The trivia Question Pack stays out of the client bundle only while the files a
 * client bundles reach `./logic` — which deals from the pack — through *types
 * alone*. The catch is that `export { type X } from './logic'` (a value-export
 * block with an inline `type`) and `import { type X } from './logic'` keep the
 * module edge and pull the whole of `./logic`, and the pack behind it, into the
 * bundle — while `export type { X }` / `import type { X }` erase the statement
 * whole. The two forms are identical to the type-checker, the linter, and every
 * runtime test, so a regression from one to the other passes all of them and
 * silently re-ships every answer. Only a bundler sees the difference (the
 * end-to-end proof is the esbuild module graph); this is the fast in-repo
 * tripwire.
 *
 * It scans *every* trivia source that can land in a client bundle — not just the
 * entry — because the leak this replaced came through the screens, not the
 * barrel. The only exemptions are the two server-only files that legitimately
 * hold the deal: `logic.ts` (the rules) and `questions.ts` (which imports the
 * pack). Any other file, present or added later, that reaches `./logic` or
 * `./questions` through a value edge fails here.
 *
 * It lives in `@huddle/game-registry` rather than beside the trivia source
 * because it reads files with `node:fs`, and the game packages are React Native
 * with no Node types — the registry owns the client entry these sources feed,
 * and already has the Node types.
 */
const TRIVIA_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'games', 'trivia', 'src');
const REGISTRY_SRC = dirname(fileURLToPath(import.meta.url));

/** The rules and the deal: the server's alone, and the only files that may reach the pack. */
const SERVER_ONLY = new Set(['logic.ts', 'questions.ts']);

function triviaClientSources(): readonly string[] {
  return readdirSync(TRIVIA_SRC).filter(
    (name) =>
      /\.tsx?$/.test(name) &&
      !name.endsWith('.test.ts') &&
      !name.endsWith('.test.tsx') &&
      !SERVER_ONLY.has(name),
  );
}

function registryClientSources(): readonly string[] {
  return readdirSync(REGISTRY_SRC).filter(
    (name) => /\.tsx?$/.test(name) && !name.endsWith('.test.ts') && !name.endsWith('.test.tsx'),
  );
}

function valueEdgesTo(source: string, modules: string): readonly string[] {
  const staticEdges = source.matchAll(
    new RegExp(
      `(?:^|\\n)\\s*(?:import|export)\\s+(?!type\\b)[^;]*?(?:from\\s+)?['"]\\.\\/(?:${modules})['"]`,
      'g',
    ),
  );
  const dynamicEdges = source.matchAll(
    new RegExp(`\\b(?:import|require)\\s*\\(\\s*['"]\\.\\/(?:${modules})['"]`, 'g'),
  );

  return [...staticEdges, ...dynamicEdges].map((match) => match[0].trim());
}

describe('the seam guard recognizes every runtime module edge', () => {
  it('rejects static, side-effect, dynamic, and inline-type value edges', () => {
    const edges = [
      "import logic from './logic';",
      "import * as logic from './logic';",
      "import { type GameState } from './logic';",
      "import './logic';",
      "export * from './logic';",
      "export { type GameState } from './logic';",
      "const logic = import('./logic');",
      "const logic = require('./logic');",
    ].join('\n');

    expect(valueEdgesTo(edges, 'logic')).toHaveLength(8);
  });

  it('allows erased type-only edges', () => {
    const types = [
      "import type { GameState } from './logic';",
      "export type { GameState } from './logic';",
    ].join('\n');

    expect(valueEdgesTo(types, 'logic')).toEqual([]);
  });
});

describe('the trivia client sources keep the pack at arm’s length', () => {
  it.each(triviaClientSources())('%s reaches ./logic and ./questions through types only', (name) => {
    const text = readFileSync(join(TRIVIA_SRC, name), 'utf8');

    // Default, namespace, side-effect, dynamic, `require`, and inline-type
    // imports/exports are all runtime edges. Only `import type` / `export type`
    // erase the statement and are allowed.
    expect(valueEdgesTo(text, 'logic|questions')).toEqual([]);
  });
});

describe('the client registry keeps server game logic out of its graph', () => {
  it.each(registryClientSources())('%s reaches ./logic through types only', (name) => {
    const text = readFileSync(join(REGISTRY_SRC, name), 'utf8');

    expect(valueEdgesTo(text, 'logic')).toEqual([]);
  });
});
