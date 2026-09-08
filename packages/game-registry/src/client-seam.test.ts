import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * 5.9's seam, guarded at the one place the other checks cannot see it.
 *
 * Curated Trivia questions and Voting prompts stay out of the client bundle
 * only while the files a client bundles reach server logic through *types
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
 * It scans *every* game source that can land in a client bundle — not just the
 * entry — because leaks can arrive through screens instead of the barrel. The
 * only exemptions are each game's declared server-only rules and content
 * files. Any other file, present or added later, that reaches one of those
 * modules through a value edge fails here.
 *
 * It lives in `@huddle/game-registry` rather than beside the trivia source
 * because it reads files with `node:fs`, and the game packages are React Native
 * with no Node types — the registry owns the client entry these sources feed,
 * and already has the Node types.
 */
const WORKSPACE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const REGISTRY_SRC = dirname(fileURLToPath(import.meta.url));

type GameSeam = {
  readonly name: string;
  readonly sourceRoot: string;
  readonly forbiddenModules: string;
  readonly serverOnly: ReadonlySet<string>;
};

const GAME_SEAMS: readonly GameSeam[] = [
  {
    name: 'trivia',
    sourceRoot: join(WORKSPACE_ROOT, 'games', 'trivia', 'src'),
    forbiddenModules: 'logic|questions',
    serverOnly: new Set(['logic.ts', 'questions.ts']),
  },
  {
    name: 'voting',
    sourceRoot: join(WORKSPACE_ROOT, 'games', 'voting', 'src'),
    forbiddenModules: 'logic|prompts',
    serverOnly: new Set(['logic.ts', 'prompts.ts']),
  },
];

function gameClientSources(game: GameSeam): readonly string[] {
  const names: string[] = [];

  function visit(directory: string, prefix = ''): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relativeName = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        visit(join(directory, entry.name), relativeName);
        continue;
      }
      if (
        /\.tsx?$/.test(entry.name) &&
        !entry.name.endsWith('.test.ts') &&
        !entry.name.endsWith('.test.tsx') &&
        !game.serverOnly.has(relativeName)
      ) {
        names.push(relativeName);
      }
    }
  }

  visit(game.sourceRoot);
  return names.sort();
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

/** Runtime-only relative imports used to walk the client-side source graph. */
function runtimeRelativeImports(source: string): readonly string[] {
  const imports = source.matchAll(
    /(?:^|\n)\s*(?:import|export)\s+(?!type\b)[^;]*?(?:from\s+)?['"](\.[^'"]+)['"]/g,
  );
  const sideEffects = source.matchAll(/\bimport\s*['"](\.[^'"]+)['"]/g);
  const dynamic = source.matchAll(/\b(?:import|require)\s*\(\s*['"](\.[^'"]+)['"]/g);
  return [...imports, ...sideEffects, ...dynamic].map((match) => match[1]!);
}

function resolveSourceImport(source: string, imported: string): string | undefined {
  const base = join(dirname(source), imported);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), `${base}.json`];
  return candidates.find((candidate) => {
    try {
      readFileSync(candidate);
      return true;
    } catch {
      return false;
    }
  });
}

function clientRuntimeGraph(sourceRoot: string, entryNames: readonly string[]): readonly string[] {
  const pending = entryNames.map((name) => join(sourceRoot, name));
  const visited = new Set<string>();

  while (pending.length > 0) {
    const source = pending.pop();
    if (source === undefined || visited.has(source)) continue;
    visited.add(source);
    const text = readFileSync(source, 'utf8');
    for (const imported of runtimeRelativeImports(text)) {
      const target = resolveSourceImport(source, imported);
      if (target !== undefined) pending.push(target);
    }
  }

  return [...visited].sort();
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

describe.each(GAME_SEAMS)('$name client sources keep curated content at arm’s length', (game) => {
  it.each(gameClientSources(game))('%s reaches server-only modules through types only', (name) => {
    const text = readFileSync(join(game.sourceRoot, name), 'utf8');

    // Default, namespace, side-effect, dynamic, `require`, and inline-type
    // imports/exports are all runtime edges. Only `import type` / `export type`
    // erase the statement and are allowed.
    expect(valueEdgesTo(text, game.forbiddenModules)).toEqual([]);
  });

  it('keeps the production client graph away from content JSON and server modules', () => {
    const graph = clientRuntimeGraph(game.sourceRoot, ['index.ts', 'phone-screen.tsx', 'tv-screen.tsx']);

    for (const source of graph) {
      const relativeName = source.slice(game.sourceRoot.length + 1);
      expect(game.serverOnly, relativeName).not.toContain(relativeName);
      expect(relativeName, 'client graph must not contain content JSON').not.toMatch(/\.json$/);
    }
  });
});

describe('the client registry keeps server game logic out of its graph', () => {
  it.each(registryClientSources())('%s reaches ./logic through types only', (name) => {
    const text = readFileSync(join(REGISTRY_SRC, name), 'utf8');

    expect(valueEdgesTo(text, 'logic')).toEqual([]);
  });
});
