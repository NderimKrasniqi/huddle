import { describe, expect, it } from 'vitest';

import { CURATED_CATEGORIES } from './categories';
import { CURATED_PACK } from './curated-pack';

/**
 * The drift guard that lets `CURATED_CATEGORIES` be hand-authored.
 *
 * `categories.ts` lists the pack's categories without importing the
 * pack, which is what keeps the questions out of a client bundle (5.9). The cost
 * of not deriving the list is that it could fall out of step with the pack —
 * except that this test derives it the old way (order of first appearance, as
 * `PACK_CATEGORIES` did) and asserts the two are identical. A category added to
 * the pack, renamed, or reordered fails here until the hand-authored list is
 * brought back in line. The test may import `CURATED_PACK`; it never ships.
 */
describe('the client-safe category list', () => {
  it('matches the categories the pack actually uses, in first-appearance order', () => {
    const fromPack = [...new Set(CURATED_PACK.questions.map((question) => question.category))];

    expect(CURATED_CATEGORIES).toEqual(fromPack);
  });
});
