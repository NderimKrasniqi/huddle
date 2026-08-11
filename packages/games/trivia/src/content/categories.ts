import { RESERVED_CATEGORY } from './category-contract';

/**
 * The Curated Pack's category names, and the reserved "no filter" word — the
 * client-safe half of the pack.
 *
 * The whole point of this module is what it does *not* import. `CURATED_PACK`
 * (in `./curated-pack`) carries every question's text and correct answer, and a
 * client that imports it ships the answers: `questionsFor` is deterministic, so
 * a modified Controller holding the pack can reproduce the exact deal and know
 * every answer before the TV asks (docs/implementation-plan.md 5.9). The Host's
 * category filter still needs the *names* of the categories, though — and a
 * category name is not an answer. So the names live here, as a plain list with
 * no path to the questions, and reach the Controller through trivia's
 * settings module while the pack itself stays server-side.
 *
 * Hand-authored rather than derived, precisely so importing it pulls in no
 * questions: `categories.test.ts` imports both this list and the real
 * `CURATED_PACK` and fails if they ever disagree, so the list cannot drift from
 * the pack even though it is not computed from it. Order of first appearance,
 * matching how `PACK_CATEGORIES` used to read them off the pack.
 */
export const CURATED_CATEGORIES: readonly string[] = [
  'Movies',
  'Music',
  'Science',
  'History',
  'Geography',
  'Food & Drink',
];

// Re-exported from the client-safe entry so a consumer that needs the "all
// categories" sentinel alongside the names takes both from one pack-free import
// rather than reaching back into the schema module by name. The sentinel lives
// in the tiny `category-contract` module so the filter and the validation gate
// share one value without creating a runtime edge to the pack schema.
export { RESERVED_CATEGORY };
