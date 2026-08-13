import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { type QuestionPack, questionPackSchema } from './question-pack';

/**
 * Pack Validation: the Question Pack schema pointed at files on disk.
 *
 * A pack is hand-written data, so the thing that keeps a broken one out of the
 * repo is a gate rather than a type — `pnpm validate:packs`, which CI runs and
 * which is `validate-packs.ts` wrapped around this. The reading and reporting
 * live here, away from the process's argv and exit code, so both are testable
 * without spawning anything.
 */

/** Where the packs that ship with Huddle live. */
export const PACKS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '../packs');

export type PackFileReport =
  | { readonly file: string; readonly ok: true; readonly pack: QuestionPack }
  | { readonly file: string; readonly ok: false; readonly problem: string };

/**
 * Validates every `.json` file in `directory`, in name order so a run reads the
 * same way twice.
 *
 * Reports rather than throws: a run should say everything that is wrong with
 * every pack, not stop at the first one — an author fixing a hundred questions
 * wants the whole list.
 */
export function validatePacksIn(directory: string): PackFileReport[] {
  return readdirSync(directory)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => validatePackFile(directory, file));
}

function validatePackFile(directory: string, file: string): PackFileReport {
  let contents: unknown;
  try {
    contents = JSON.parse(readFileSync(join(directory, file), 'utf8'));
  } catch (error) {
    return { file, ok: false, problem: `not valid JSON: ${(error as Error).message}` };
  }

  const parsed = questionPackSchema.safeParse(contents);

  if (!parsed.success) {
    return { file, ok: false, problem: z.prettifyError(parsed.error) };
  }

  // A pack is named after its id, which the schema cannot see
  // — it is only ever handed the contents. Left unchecked, renaming the file or
  // editing the id would leave the pack findable by one name and referred to by
  // another, with CI green either way.
  const expected = basename(file, '.json');
  if (parsed.data.id !== expected) {
    return {
      file,
      ok: false,
      problem: `✖ id "${parsed.data.id}" does not match the file name — rename the file to ${parsed.data.id}.json, or give the pack the id "${expected}"`,
    };
  }

  return { file, ok: true, pack: parsed.data };
}
