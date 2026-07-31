import { describe, expect, it } from 'vitest';

import { type QuestionPack, questionPackSchema } from './question-pack';

/**
 * The Question Pack format, held to the shape docs/CONTEXT.md gives it.
 *
 * Every test here is a way a hand-written pack goes wrong — three options
 * instead of four, an answer index pointing past the end, a difficulty nobody
 * defined — because the schema exists to catch exactly those before a pack
 * reaches a party. `pnpm validate:packs` is this schema pointed at files.
 */

const question = {
  text: 'Which planet is closest to the Sun?',
  options: ['Mercury', 'Venus', 'Earth', 'Mars'],
  correctIndex: 0,
  category: 'Science',
  difficulty: 'easy',
};

const pack = {
  id: 'test-pack',
  title: 'Test Pack',
  version: 1,
  questions: [question],
};

/** The pack above with one question field replaced — the shape of most tests. */
const packWithQuestion = (changes: Record<string, unknown>) => ({
  ...pack,
  questions: [{ ...question, ...changes }],
});

describe('questionPackSchema', () => {
  it('accepts a well-formed pack', () => {
    const parsed: QuestionPack = questionPackSchema.parse(pack);

    expect(parsed.questions[0]?.options).toEqual(['Mercury', 'Venus', 'Earth', 'Mars']);
  });

  it('rejects a pack with no questions', () => {
    expect(questionPackSchema.safeParse({ ...pack, questions: [] }).success).toBe(false);
  });

  it('rejects an id that is not a slug', () => {
    // The id names the pack everywhere a pack is referred to, including in the
    // file it ships as, so it is a slug and not prose.
    expect(questionPackSchema.safeParse({ ...pack, id: 'Test Pack' }).success).toBe(false);
  });

  it('rejects a version that is not a whole number above zero', () => {
    expect(questionPackSchema.safeParse({ ...pack, version: 0 }).success).toBe(false);
    expect(questionPackSchema.safeParse({ ...pack, version: 1.5 }).success).toBe(false);
  });

  it('rejects a question offering other than four options', () => {
    // Four is the TV's layout and the phone's four buttons — a question with
    // three of them is unplayable, not merely unusual.
    expect(questionPackSchema.safeParse(packWithQuestion({ options: ['A', 'B', 'C'] })).success).toBe(
      false,
    );
    expect(
      questionPackSchema.safeParse(packWithQuestion({ options: ['A', 'B', 'C', 'D', 'E'] })).success,
    ).toBe(false);
  });

  it('rejects a question whose options repeat', () => {
    expect(
      questionPackSchema.safeParse(packWithQuestion({ options: ['Venus', 'Venus', 'Earth', 'Mars'] }))
        .success,
    ).toBe(false);
  });

  it('rejects a correctIndex pointing at no option', () => {
    expect(questionPackSchema.safeParse(packWithQuestion({ correctIndex: 4 })).success).toBe(false);
    expect(questionPackSchema.safeParse(packWithQuestion({ correctIndex: -1 })).success).toBe(false);
  });

  it('rejects a difficulty nobody defined', () => {
    expect(questionPackSchema.safeParse(packWithQuestion({ difficulty: 'tricky' })).success).toBe(
      false,
    );
  });

  it('rejects an empty question text, option or category', () => {
    expect(questionPackSchema.safeParse(packWithQuestion({ text: '' })).success).toBe(false);
    expect(
      questionPackSchema.safeParse(packWithQuestion({ options: ['', 'B', 'C', 'D'] })).success,
    ).toBe(false);
    expect(questionPackSchema.safeParse(packWithQuestion({ category: '' })).success).toBe(false);
  });

  it('rejects a category named after the filter’s own sentinel', () => {
    // A pack shipping a category called "all" would hand the Host an option
    // that dealt them an unfiltered game instead of that category — the two
    // share one space, so the pack is where the collision is refused.
    expect(questionPackSchema.safeParse(packWithQuestion({ category: 'all' })).success).toBe(false);
    expect(questionPackSchema.safeParse(packWithQuestion({ category: 'All' })).success).toBe(false);
    expect(questionPackSchema.safeParse(packWithQuestion({ category: ' ALL ' })).success).toBe(false);
    // Only the word itself: a category that merely contains it is fine.
    expect(questionPackSchema.safeParse(packWithQuestion({ category: 'All Sports' })).success).toBe(
      true,
    );
  });

  it('rejects a misspelled field rather than ignoring it', () => {
    // A pack that says `answerIndex` has an answer nobody reads, and would
    // otherwise fail only on the required field it forgot to spell right.
    const { correctIndex, ...withoutAnswer } = question;

    expect(
      questionPackSchema.safeParse({
        ...pack,
        questions: [{ ...withoutAnswer, answerIndex: correctIndex }],
      }).success,
    ).toBe(false);
  });

  it('rejects two questions asking the same thing', () => {
    // Authoring a hundred questions by hand is how a paragraph gets pasted
    // twice; the pack is the only place that duplication can be seen.
    expect(
      questionPackSchema.safeParse({ ...pack, questions: [question, { ...question }] }).success,
    ).toBe(false);
  });
});
