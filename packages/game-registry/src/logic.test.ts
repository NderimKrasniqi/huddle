import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { clampBrowsingIndex } from './browsing';
import { CAROUSEL_PLACEHOLDER_COUNT } from './carousel-catalog';
import { browsingIndex, GAME_LOGIC_REGISTRY } from './logic';

const here = dirname(fileURLToPath(import.meta.url));

/** Every module the server's entry point reaches, following relative imports. */
function reachableFromLogic(): Map<string, string> {
  const reached = new Map<string, string>();
  const pending = ['logic.ts'];

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
 * The seam this package exists to hold: the Convex server imports
 * `@huddle/game-registry/logic`, and a game's screens are React Native that has
 * no business in a server bundle.
 *
 * This is a *source* check, not a bundle check — it reads the import graph
 * rather than building it, so it cannot see what a bundler would inline from
 * outside this directory. It guards the failure that actually happened: adding
 * `export { browsingIndex } from './carousel'` to the server's entry point,
 * which reached `./registry`, which holds every module whole. Nothing caught
 * it; the bundle simply grew the screens back.
 */
describe('the entry point the Convex server imports', () => {
  it('never reaches the Registry that holds the screens', () => {
    const reached = reachableFromLogic();

    expect([...reached.keys()].sort()).not.toContain('registry.ts');
    expect([...reached.keys()].sort()).not.toContain('carousel.ts');
    expect([...reached.keys()].sort()).not.toContain('running.ts');
  });

  it('never imports a game module’s screens half', () => {
    for (const [name, source] of reachableFromLogic()) {
      const gamePackages = [...source.matchAll(/from '(@huddle\/game-[\w-]+)(\/[\w-]+)?'/g)];

      for (const [, packageName, entryPoint] of gamePackages) {
        // `@huddle/game-core` is the interface, not a game — types only, and
        // nothing of React but the word. Every actual game module has to be
        // reached through its `/logic` entry point, because the bare package is
        // the one that carries the screens.
        if (packageName === '@huddle/game-core') {
          continue;
        }

        expect(entryPoint, `${name} imports ${packageName} whole`).toBe('/logic');
      }
    }
  });
});

describe('the server’s carousel clamp', () => {
  it('clamps over the games the server installs', () => {
    expect(browsingIndex(99)).toBe(GAME_LOGIC_REGISTRY.length + CAROUSEL_PLACEHOLDER_COUNT - 1);
    expect(browsingIndex(undefined)).toBe(0);
  });

  it('is the same arithmetic the clients use', () => {
    for (const stored of [undefined, null, -1, 0, 1, 99, Number.NaN]) {
      expect(browsingIndex(stored)).toBe(
        clampBrowsingIndex(stored, GAME_LOGIC_REGISTRY.length + CAROUSEL_PLACEHOLDER_COUNT),
      );
    }
  });
});
