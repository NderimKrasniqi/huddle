import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The plan's design rule — "all styling comes from the Boardwalk theme
 * package; no hex value outside it" — enforced rather than merely believed.
 * It runs in the unit suite so CI fails the moment a color is written
 * anywhere but `packages/ui`.
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

const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/g;
const HEX_DIGIT_COUNTS = new Set([3, 4, 6, 8]);

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
    const files = sourceFiles();
    // Without this the guard passes vacuously if the file listing ever breaks.
    expect(files.length).toBeGreaterThan(0);

    const offenders = files.flatMap((file) => {
      const hexes = hexColorsIn(file);
      return hexes.length === 0 ? [] : [`${file}: ${hexes.join(', ')}`];
    });

    expect(offenders).toEqual([]);
  });

  it('are actually recognised by the matcher guarding them', () => {
    expect("backgroundColor: '#EDE5D4'".match(HEX_COLOR)).toEqual(['#EDE5D4']);
    expect('#abcz'.match(HEX_COLOR)).toBeNull();
  });
});
