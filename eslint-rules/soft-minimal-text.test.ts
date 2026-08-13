import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '..');

/**
 * The retired design name is retained only as historical design provenance. Keep the active
 * app/theme and lint-rule surfaces free of that retired product name so a new
 * screen cannot quietly copy the old handoff by wording alone.
 */
const ACTIVE_ROOTS = [
  'apps/phone/app',
  'apps/phone/src',
  'apps/tv/app',
  'apps/tv/src',
  'packages/ui',
  'eslint-rules',
  'eslint.config.js',
];
const RETIRED_DESIGN_NAME = ['Board', 'walk'].join('');

function filesUnder(relativePath: string): string[] {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!statSync(absolutePath).isDirectory()) return [absolutePath];
  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(absolutePath, entry.name);
    return entry.isDirectory() ? filesUnder(path.relative(repoRoot, child)) : [child];
  });
}

describe('active Soft Minimal surfaces', () => {
  it('contain no retired design-name references', () => {
    const stale = ACTIVE_ROOTS.flatMap(filesUnder)
      .filter((filePath) => /\.(?:js|json|ts|tsx|md)$/.test(filePath))
      .flatMap((filePath) => {
        const text = readFileSync(filePath, 'utf8');
        return new RegExp(RETIRED_DESIGN_NAME, 'i').test(text)
          ? [path.relative(repoRoot, filePath)]
          : [];
      });

    expect(stale).toEqual([]);
  });
});
