import { relative } from 'node:path';
import process from 'node:process';

import { type PackFileReport, PACKS_DIRECTORY, validatePacksIn } from './pack-validation';

function main(): void {
  const directory = process.argv[2] ?? PACKS_DIRECTORY;
  const shown = describePath(directory);

  console.log(`Validating question packs in ${shown}`);

  let reports: PackFileReport[];
  try {
    reports = validatePacksIn(directory);
  } catch (error) {
    console.error(`Could not read ${shown}: ${(error as Error).message}`);
    process.exitCode = 1;
    return;
  }

  for (const report of reports) {
    console.log(report.ok ? describeValidPack(report) : describeInvalidPack(report));
  }

  if (reports.length === 0) {
    console.error('No packs found — is that the right directory?');
    process.exitCode = 1;
    return;
  }

  const failed = reports.filter((report) => !report.ok).length;
  if (failed > 0) {
    console.error(`\n${failed} of ${reports.length} pack(s) are invalid.`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nAll ${reports.length} pack(s) are valid.`);
}

function describePath(directory: string): string {
  const fromHere = relative(process.cwd(), directory);

  return fromHere && !fromHere.startsWith('..') ? fromHere : directory;
}

function describeValidPack(report: Extract<PackFileReport, { ok: true }>): string {
  const categories = new Set(report.pack.questions.map((question) => question.category));

  return (
    `  ok      ${report.file} — ${report.pack.title} v${report.pack.version}, ` +
    `${report.pack.questions.length} questions, ${categories.size} categories`
  );
}

function describeInvalidPack(report: Extract<PackFileReport, { ok: false }>): string {
  return `  FAILED  ${report.file}\n${report.problem.replace(/^/gm, '          ')}`;
}

main();
