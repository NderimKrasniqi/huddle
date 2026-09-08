import { describe, expect, it } from 'vitest';

import { CURATED_PACK } from './curated-pack';
import { questionPackSchema } from './question-pack';

/**
 * The one pack that ships in the repo, held to the size a game night needs.
 *
 * The plan's floor is 100 questions across at least 4 categories: enough that a
 * 20-question game never repeats itself, and enough that the Host's category
 * filter has something to filter.
 */
describe('the curated pack', () => {
  it('is a valid Question Pack', () => {
    expect(questionPackSchema.safeParse(CURATED_PACK).success).toBe(true);
  });

  it('holds at least a hundred questions', () => {
    expect(CURATED_PACK.questions.length).toBeGreaterThanOrEqual(100);
  });

  it('spreads them across at least four categories', () => {
    const categories = new Set(CURATED_PACK.questions.map((question) => question.category));

    expect(categories.size).toBeGreaterThanOrEqual(4);
  });

  it('gives every category enough questions to fill a game', () => {
    // The longest game trivia offers is 20 questions (Phase 4's settings), and
    // a category filter that cannot fill one is a filter that repeats itself.
    const counts = new Map<string, number>();
    for (const question of CURATED_PACK.questions) {
      counts.set(question.category, (counts.get(question.category) ?? 0) + 1);
    }

    for (const [category, count] of counts) {
      expect(count, `category ${category}`).toBeGreaterThanOrEqual(20);
    }
  });

  it('puts the right answer in all four positions', () => {
    // A pack whose answer is always the first option is one a player can win
    // without reading it, and the schema cannot see that — only the content can.
    const positions = new Set(CURATED_PACK.questions.map((question) => question.correctIndex));

    expect([...positions].sort()).toEqual([0, 1, 2, 3]);
  });
});
