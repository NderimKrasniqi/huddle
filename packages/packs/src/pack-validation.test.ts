import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PACKS_DIRECTORY, validatePacksIn } from './pack-validation';

/**
 * Pack Validation: the gate that keeps a typo'd question out of the repo.
 *
 * The function is tested against directories written here, and the command is
 * tested by running it — `pnpm validate:packs` is what CI calls, so its exit
 * code is the thing that actually has to be wrong for a bad pack, and only
 * spawning it proves that.
 */

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

const goodPack = {
  id: 'fixture-pack',
  title: 'Fixture Pack',
  version: 1,
  questions: [
    {
      text: 'Which planet is closest to the Sun?',
      options: ['Mercury', 'Venus', 'Earth', 'Mars'],
      correctIndex: 0,
      category: 'Science',
      difficulty: 'easy',
    },
  ],
};

/** The same pack with an answer index pointing past the last option. */
const malformedPack = {
  ...goodPack,
  questions: [{ ...goodPack.questions[0], correctIndex: 7 }],
};

let fixtures: string;
let goodDirectory: string;
let malformedDirectory: string;
let unparseableDirectory: string;
let emptyDirectory: string;

const writePackDirectory = (name: string, files: Record<string, string>) => {
  const directory = join(fixtures, name);
  mkdirSync(directory);
  for (const [file, contents] of Object.entries(files)) {
    writeFileSync(join(directory, file), contents);
  }
  return directory;
};

beforeAll(() => {
  fixtures = mkdtempSync(join(tmpdir(), 'huddle-packs-'));
  goodDirectory = writePackDirectory('good', {
    'fixture-pack.json': JSON.stringify(goodPack),
  });
  malformedDirectory = writePackDirectory('malformed', {
    'fixture-pack.json': JSON.stringify(malformedPack),
  });
  unparseableDirectory = writePackDirectory('unparseable', {
    'fixture-pack.json': '{ "id": "fixture-pack",',
  });
  emptyDirectory = writePackDirectory('empty', {});
});

afterAll(() => {
  rmSync(fixtures, { recursive: true, force: true });
});

describe('validatePacksIn', () => {
  it('passes every pack that ships in the repo', () => {
    const reports = validatePacksIn(PACKS_DIRECTORY);

    expect(reports.length).toBeGreaterThan(0);
    expect(reports.filter((report) => !report.ok)).toEqual([]);
  });

  it('passes a well-formed pack', () => {
    expect(validatePacksIn(goodDirectory)).toEqual([
      { file: 'fixture-pack.json', ok: true, pack: goodPack },
    ]);
  });

  it('fails a malformed pack, saying which field is wrong', () => {
    const [report] = validatePacksIn(malformedDirectory);

    expect(report?.ok).toBe(false);
    expect(report?.ok === false && report.problem).toContain('correctIndex');
  });

  it('fails a pack whose id is not the name of its file', () => {
    // A pack is found by file name and referred to by id; the schema is handed
    // the contents alone, so nothing else can notice the two drifting apart.
    const directory = writePackDirectory('misnamed', {
      'general-knowledge.json': JSON.stringify(goodPack),
    });

    const [report] = validatePacksIn(directory);

    expect(report?.ok).toBe(false);
    expect(report?.ok === false && report.problem).toContain('fixture-pack');
  });

  it('fails a file that is not JSON at all', () => {
    const [report] = validatePacksIn(unparseableDirectory);

    expect(report?.ok).toBe(false);
  });

  it('looks only at JSON files', () => {
    const directory = writePackDirectory('mixed', {
      'fixture-pack.json': JSON.stringify(goodPack),
      'README.md': '# not a pack',
    });

    expect(validatePacksIn(directory).map((report) => report.file)).toEqual(['fixture-pack.json']);
  });
});

/**
 * The command CI runs. Spawning `pnpm` is slower than calling a function, and
 * the point is exactly that: the acceptance criterion is about what
 * `pnpm validate:packs` exits with, which nothing short of running it can show.
 */
describe('pnpm validate:packs', () => {
  const run = (directory?: string) =>
    spawnSync('pnpm', directory ? ['validate:packs', directory] : ['validate:packs'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

  it('succeeds on the packs that ship in the repo', { timeout: 60_000 }, () => {
    const result = run();

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('huddle-classics.json');
  });

  // `toBe(1)` and never `not.toBe(0)`: a `spawnSync` that failed to launch
  // `pnpm` at all reports a null status, which would satisfy "not zero" while
  // proving nothing about the gate.
  it('fails on a malformed pack', { timeout: 60_000 }, () => {
    const result = run(malformedDirectory);

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain('fixture-pack.json');
  });

  it('fails on a directory holding no packs at all', { timeout: 60_000 }, () => {
    // Otherwise a mistyped path would report nothing wrong with nothing.
    expect(run(emptyDirectory).status).toBe(1);
  });
});
