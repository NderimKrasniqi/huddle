import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { colors } from './colors';

/**
 * The plan's design rule — "all styling comes from the Boardwalk theme
 * package; no hex value outside it" — enforced rather than merely believed.
 * It runs in the unit suite so CI fails the moment a color is written
 * anywhere but `packages/ui`.
 *
 * The app configs are the single exception, and a conditional one. Expo needs a
 * window `backgroundColor` in the config to paint the native window before any
 * React view exists, and the config cannot import the token: Expo transpiles
 * `app.config.ts` and then `require`s it, so an imported `.ts` file is never
 * transpiled and the import fails outright. The literal is therefore allowed
 * *only where it equals a Boardwalk value*, which keeps the rule's actual
 * purpose — no color is ever invented outside the theme — rather than trading
 * it away for the exception.
 */

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: import.meta.dirname,
  encoding: 'utf8',
}).trim();

const CODE_FILE = /\.(?:ts|tsx|js|jsx|mjs|cjs|json)$/;

/**
 * `docs/` is the design source of truth and quotes the palette by value;
 * `packages/ui/src/` is where those values legitimately live.
 */
const EXEMPT = /^(?:docs\/|packages\/ui\/src\/)/;

/** An app's Expo config — the one place a literal is allowed, if it matches. */
const APP_CONFIG = /^apps\/[^/]+\/app\.json$/;

const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/g;
const HEX_DIGIT_COUNTS = new Set([3, 4, 6, 8]);

/**
 * Compared case-insensitively in both directions: the palette is written upper
 * case today, but a lower-case token would otherwise silently stop matching and
 * the guard would start rejecting colors that are in fact Boardwalk's.
 */
const BOARDWALK_VALUES = new Set<string>(
  Object.values(colors).map((value) => value.toUpperCase()),
);

/** Every source file git knows about, including files not yet committed. */
function sourceFiles(): string[] {
  const listed = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard'],
    { cwd: repoRoot, encoding: 'utf8' },
  );

  return listed
    .split('\n')
    .filter((file) => file !== '' && CODE_FILE.test(file) && !EXEMPT.test(file));
}

function hexColorsIn(file: string): string[] {
  const matches = readFileSync(path.join(repoRoot, file), 'utf8').match(HEX_COLOR) ?? [];
  return matches.filter((match) => HEX_DIGIT_COUNTS.has(match.length - 1));
}

describe('hex color literals', () => {
  it('exist nowhere outside packages/ui', () => {
    const files = sourceFiles().filter((file) => !APP_CONFIG.test(file));
    // Without this the guard passes vacuously if the file listing ever breaks.
    expect(files.length).toBeGreaterThan(0);

    const offenders = files.flatMap((file) => {
      const hexes = hexColorsIn(file);
      return hexes.length === 0 ? [] : [`${file}: ${hexes.join(', ')}`];
    });

    expect(offenders).toEqual([]);
  });

  it('are Boardwalk values wherever an app config states one', () => {
    const configs = sourceFiles().filter((file) => APP_CONFIG.test(file));
    // Pinned to the two apps that exist: zero would make the exception
    // untested, and a new app should have to opt into it deliberately.
    expect(configs.length).toBe(2);

    const strays = configs.flatMap((file) =>
      hexColorsIn(file)
        .filter((hex) => !BOARDWALK_VALUES.has(hex.toUpperCase()))
        .map((hex) => `${file}: ${hex}`),
    );

    expect(strays).toEqual([]);
  });

  it('are what each app paints its own root screen with', () => {
    // The window background exists to pre-empt the root view, so drifting from
    // it would reintroduce exactly the flash it was added to remove.
    const background = (app: string): unknown =>
      JSON.parse(readFileSync(path.join(repoRoot, 'apps', app, 'app.json'), 'utf8')).expo
        .backgroundColor;

    expect(background('tv')).toBe(colors.screen);
    expect(background('controller')).toBe(colors.canvas);
  });

  it('are actually recognised by the matcher guarding them', () => {
    expect("backgroundColor: '#EDE5D4'".match(HEX_COLOR)).toEqual(['#EDE5D4']);
    expect('#abcz'.match(HEX_COLOR)).toBeNull();
  });
});
