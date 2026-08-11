import huddleClassics from '../../packs/huddle-classics.json';

import { type QuestionPack, questionPackSchema } from './question-pack';

/**
 * The one Question Pack that ships in the repo: 120 general-knowledge questions
 * across six categories, which is enough that the longest game trivia offers
 * (20 questions) never repeats itself, in any single category the Host filters
 * to.
 *
 * It is a JSON file under `packs/` rather than a TypeScript literal because a
 * pack is data — the same thing an importer or an AI-generated themed pack will
 * one day write out — and `pnpm validate:packs` checks that directory, not this
 * server module. Parsing it here is what turns that data into a `QuestionPack`:
 * a raw JSON import types `options` as `string[]`, and the schema is the only
 * thing that can honestly narrow it to the four the TV draws. The check costs a
 * fraction of a millisecond, once, when the server rules load.
 */
export const CURATED_PACK: QuestionPack = questionPackSchema.parse(huddleClassics);
