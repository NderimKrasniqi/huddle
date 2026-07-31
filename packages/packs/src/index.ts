// The Question Pack format: one Zod schema that both validates a pack file and
// types what comes out of it.
export {
  DIFFICULTIES,
  type Difficulty,
  type PackQuestion,
  packQuestionSchema,
  QUESTION_OPTION_COUNT,
  type QuestionPack,
  questionPackSchema,
  RESERVED_CATEGORY,
} from './question-pack';
// The pack that ships in the repo, parsed from its file.
export { CURATED_PACK } from './curated-pack';

// Pack Validation (`pack-validation.ts`) is deliberately *not* re-exported: it
// reads a directory, so it imports `node:fs`, which a phone has no answer for.
// The `pnpm validate:packs` command imports that module by name — the same seam
// the trivia module draws around its screens, for the same reason.
