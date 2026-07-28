/**
 * One trivia question: what the TV asks, the four options it offers, and which
 * of them is right.
 *
 * The shape Phase 4's Question Pack schema will validate, minus the fields only
 * a pack has a use for (category and difficulty, which are what the Host's
 * category filter reads). A game holds questions, not packs: the reducer below
 * asks a list of these, and where the list came from is the pack format's
 * business (docs/implementation-plan.md, Phase 4).
 */
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
 * The questions every game of trivia is dealt today.
 *
 * Deliberately not a Question Pack: a pack is a versioned data file with an id
 * and a category on every question (docs/CONTEXT.md), and these three are three
 * questions written inline so that the rules could be built and played before
 * the format they will arrive in exists. Phase 4's curated pack replaces them,
 * and `createInitialState` is the one line that has to change.
 *
 * The right answer is a different option each time, so a game answered "always
 * the first button" scores once out of three rather than three out of three —
 * which is also what keeps a reducer test from passing by accident.
 */
export const INLINE_QUESTIONS: readonly TriviaQuestion[] = [
  {
    text: 'Which planet is closest to the Sun?',
    options: ['Mercury', 'Venus', 'Earth', 'Mars'],
    correctIndex: 0,
  },
  {
    text: 'How many strings does a standard guitar have?',
    options: ['Four', 'Five', 'Six', 'Seven'],
    correctIndex: 2,
  },
  {
    text: 'What is the capital of Japan?',
    options: ['Kyoto', 'Tokyo', 'Osaka', 'Seoul'],
    correctIndex: 1,
  },
];
