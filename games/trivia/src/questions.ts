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
  /**
   * The pack category it came from, for the screens' chip. Not secret: the Host
   * picks categories in setup. Absent on games dealt before it was carried.
   */
  readonly category?: string;
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
    category: question.category,
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
function dealtByTurns(questions: readonly PackQuestion[], random?: () => number): readonly PackQuestion[] {
  const queues = new Map<string, PackQuestion[]>();

  for (const question of random ? shuffled(questions, random) : questions) {
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
  random?: () => number,
): readonly PackQuestion[] {
  if (difficulty === 'mixed') return dealtByTurns(questions, random);

  const order: readonly Difficulty[] =
    difficulty === 'easy'
      ? ['easy', 'medium', 'hard']
      : difficulty === 'medium'
        ? ['medium', 'easy', 'hard']
        : ['hard', 'medium', 'easy'];
  const prioritized = order.flatMap((level) => dealtByTurns(questions.filter((q) => q.difficulty === level), random));
  return prioritized;
}

/**
 * The questions a game started on these settings is dealt.
 *
 * With the start's `seed`, every game deals a different selection in a
 * different order, with the answers moved around too; the same seed always
 * deals the same game, so a stored game stays reproducible. Without one it is
 * the pack's fixed deal.
 *
 * A count larger than the category holds deals what there is: a short game
 * rather than a refusal or a repeated question.
 */
export function questionsFor(
  category: string,
  count: number,
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed' = 'mixed',
  seed?: number,
): readonly TriviaQuestion[] {
  const random = seed === undefined ? undefined : seededRandom(seed);
  const inCategory =
    category === EVERY_CATEGORY
      ? CURATED_PACK.questions
      : CURATED_PACK.questions.filter((question) => question.category === category);

  const dealt = dealtByDifficulty(inCategory, difficulty, random).slice(0, count).map(asked);
  // A seeded game also moves the right answer around, so it is not always "B".
  return random ? dealt.map((question) => withOptionsShuffled(question, random)) : dealt;
}

/** mulberry32: a small, well-mixed generator; the same seed deals the same game. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates over a copy. */
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function withOptionsShuffled(question: TriviaQuestion, random: () => number): TriviaQuestion {
  const order = shuffled(question.options.map((_option, index) => index), random);
  return {
    ...question,
    options: order.map((index) => question.options[index]!) as unknown as TriviaQuestion['options'],
    correctIndex: order.indexOf(question.correctIndex),
  };
}
