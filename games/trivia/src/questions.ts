import { CURATED_PACK } from './content/curated-pack';
import { type Difficulty, type PackQuestion, RESERVED_CATEGORY } from './content/question-pack';

/**
 * Where a game of trivia's questions come from: the Curated Pack, filtered and
 * counted to the settings the Host chose.
 *
 * Trivia holds questions, not packs. The pack is the only way it gets content,
 * but what the rules ask is a plain list, and everything a
 * pack knows that the rules do not — the category the Host filtered by, the
 * difficulty an author sorted by — is dropped on the way in. That is not
 * tidiness: a game's state is handed to every phone in the room, so a field the
 * rules never read is a field with no business travelling.
 */

/** One trivia question: what the TV asks, the four options, and which is right. */
export type TriviaQuestion = {
  readonly text: string;
  /**
   * Exactly four, as the TV lays them out and the phone's four buttons send —
   * a tuple, so a question that offers three is a compile error rather than
   * something the rules have to survive at runtime.
   */
  readonly options: readonly [string, string, string, string];
  /** Which of `options` is right — one of them, and only one. */
  readonly correctIndex: number;
};

/**
 * The category filter set to no filter at all.
 *
 * Not a category, and no pack may ship one that spells it the same:
 * `RESERVED_CATEGORY` is the gate, in the pack schema where a pack is checked.
 * Without it a pack could ship a category named "all", and the Host picking
 * that option would be dealt an unfiltered game rather than that category —
 * `questionsFor` below tests the sentinel before it filters, so the two share
 * one space and only one of them can have the word. It is the pack's constant
 * and not a second spelling of it, so the gate and the filter cannot drift.
 */
export const EVERY_CATEGORY = RESERVED_CATEGORY;

/**
 * The categories the pack actually uses, in the order it first uses them.
 *
 * Derived rather than declared, which is what the Host's filter is: a category
 * is whatever a pack says it is, so the options are read off the questions and
 * the two cannot disagree. Order of first appearance rather than alphabetical,
 * because a pack's own order is the one the person who wrote it chose.
 */
export const PACK_CATEGORIES: readonly string[] = [
  ...new Set(CURATED_PACK.questions.map((question) => question.category)),
];

/** A pack's question as the rules ask it. */
function asked(question: PackQuestion): TriviaQuestion {
  return {
    text: question.text,
    options: question.options,
    correctIndex: question.correctIndex,
  };
}

/**
 * The pack's questions dealt one category at a time, round after round.
 *
 * The pack is written a category at a time — twenty Movies, then twenty Music —
 * so the front of it is twenty questions about films. A room that asked for all
 * categories and got one is the same room that asked for a filter and did not
 * get to choose it, so the deal takes one from each category in turn and even
 * the shortest game spans the pack.
 *
 * Filtered to a single category this is the pack's own order, because there is
 * only one queue to take from.
 */
function dealtByTurns(questions: readonly PackQuestion[]): readonly PackQuestion[] {
  const queues = new Map<string, PackQuestion[]>();

  for (const question of questions) {
    const queue = queues.get(question.category);

    if (queue === undefined) {
      queues.set(question.category, [question]);
    } else {
      queue.push(question);
    }
  }

  // Rounds rather than "until the queues are empty": the loop then terminates by
  // construction, whatever the categories turn out to hold.
  const rounds = Math.max(0, ...[...queues.values()].map((queue) => queue.length));
  const dealt: PackQuestion[] = [];

  for (let round = 0; round < rounds; round += 1) {
    for (const queue of queues.values()) {
      const question = queue[round];

      if (question !== undefined) {
        dealt.push(question);
      }
    }
  }

  return dealt;
}

/**
 * Deal the requested difficulty first, then deterministic fallbacks. A sparse
 * curated pack must still make every setting playable, but a fallback may not
 * repeat a question or reorder the chosen difficulty behind another level.
 */
function dealtByDifficulty(
  questions: readonly PackQuestion[],
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed',
): readonly PackQuestion[] {
  if (difficulty === 'mixed') return dealtByTurns(questions);

  const order: readonly Difficulty[] =
    difficulty === 'easy'
      ? ['easy', 'medium', 'hard']
      : difficulty === 'medium'
        ? ['medium', 'easy', 'hard']
        : ['hard', 'medium', 'easy'];
  const prioritized = order.flatMap((level) => dealtByTurns(questions.filter((q) => q.difficulty === level)));
  return prioritized;
}

/**
 * The questions a game started on these settings is dealt.
 *
 * Deterministic, and the same every game: a pack is a list, this takes the front
 * of it, and nothing here reaches for a random number. That is the interface's
 * rule rather than a preference — a module is a pure function of what it is
 * handed, and `GameSetup` has nowhere for the hub to hand it a seed. It is also
 * the flat cost of that: a party playing twice in an evening is asked the same
 * questions in the same order, and shuffling them is a change to the interface
 * rather than to this line.
 *
 * A count larger than the category holds deals what there is — a short game
 * rather than a refusal or a repeated question. The pack ships twenty in every
 * category and the longest game asks for twenty, so nothing today reaches it.
 */
export function questionsFor(
  category: string,
  count: number,
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed' = 'mixed',
): readonly TriviaQuestion[] {
  const inCategory =
    category === EVERY_CATEGORY
      ? CURATED_PACK.questions
      : CURATED_PACK.questions.filter((question) => question.category === category);

  return dealtByDifficulty(inCategory, difficulty).slice(0, count).map(asked);
}
