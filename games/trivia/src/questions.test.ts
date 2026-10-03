import { describe, expect, it } from 'vitest';

import { EVERY_CATEGORY, questionsFor } from './questions';

const texts = (seed?: number) => questionsFor(EVERY_CATEGORY, 10, 'mixed', seed).map((question) => question.text);

describe('dealing questions', () => {
  it('deals the same game for the same seed', () => {
    expect(questionsFor(EVERY_CATEGORY, 10, 'mixed', 42)).toEqual(questionsFor(EVERY_CATEGORY, 10, 'mixed', 42));
  });

  it('deals a different game for a different seed', () => {
    expect(texts(1)).not.toEqual(texts(2));
  });

  it('keeps the right answer pointing at the same option after shuffling', () => {
    const plain = new Map(questionsFor(EVERY_CATEGORY, 500, 'mixed').map((question) => [question.text, question]));
    for (const question of questionsFor(EVERY_CATEGORY, 30, 'mixed', 7)) {
      const original = plain.get(question.text)!;
      expect(question.options[question.correctIndex]).toBe(original.options[original.correctIndex]);
      expect([...question.options].sort()).toEqual([...original.options].sort());
    }
  });

  it('moves the right answer between positions across a seeded game', () => {
    const positions = new Set(questionsFor(EVERY_CATEGORY, 20, 'mixed', 3).map((question) => question.correctIndex));
    expect(positions.size).toBeGreaterThan(1);
  });

  it('never repeats a question within a game', () => {
    const dealt = texts(9);
    expect(new Set(dealt).size).toBe(dealt.length);
  });
});
