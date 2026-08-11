/**
 * The Voting game's built-in prompts: what the room is asked to weigh in on.
 *
 * A prompt is a question and the closed list of answers it offers, and that is
 * the whole of the game's content. It is bundled here rather than drawn from a
 * pack (as trivia's questions are) because there is nothing to curate: a party
 * game about opinions has no right answer, so it needs no Question Pack, no
 * scoring key, and no Trivia content dependency. Keeping it self-contained is
 * also the point of a *test* game — it proves the platform runs a second module
 * that shares none of the first's content machinery.
 *
 * There are more prompts here than the longest game plays (the `rounds` setting
 * tops out below this length), so the deal in `createInitialState` always has a
 * prompt to take. They are opinions on purpose — nothing here has a wrong
 * answer to protect, which is what lets the reveal show the room the tally
 * rather than a verdict.
 */

/** One prompt: the question, and the options a phone offers under it. */
export type VotingPrompt = {
  readonly text: string;
  /** Two to four, so the phone's buttons and the TV's bars stay legible. */
  readonly options: readonly string[];
};

/**
 * The Curated Prompts, in the order a game deals them.
 *
 * Ordered rather than shuffled because `createInitialState` deals the first
 * `rounds` of them and must be pure — a game seeded from the same settings
 * deals the same prompts, which is what lets a room be asked what it was dealt
 * (see the state's `prompts`, carried from the start).
 */
export const CURATED_PROMPTS: readonly VotingPrompt[] = [
  { text: 'Pineapple on pizza?', options: ['Absolutely', 'Never', 'Only sometimes'] },
  { text: 'Cats or dogs?', options: ['Cats', 'Dogs', 'Both', 'Neither'] },
  { text: 'Best way to spend a weekend?', options: ['Out and about', 'Cosy at home'] },
  { text: 'Tea or coffee?', options: ['Tea', 'Coffee', 'Neither'] },
  { text: 'The perfect season?', options: ['Spring', 'Summer', 'Autumn', 'Winter'] },
  { text: 'Sweet or savoury?', options: ['Sweet', 'Savoury', 'Depends on the day'] },
  { text: 'Would you rather be able to…', options: ['Fly', 'Turn invisible', 'Read minds'] },
];
