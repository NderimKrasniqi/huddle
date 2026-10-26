import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { type QuestionPack, questionPackSchema } from './question-pack';

export const PACKS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '../packs');

export type PackFileReport =
  | { readonly file: string; readonly ok: true; readonly pack: QuestionPack }
  | { readonly file: string; readonly ok: false; readonly problem: string };

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
