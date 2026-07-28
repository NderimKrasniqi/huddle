import type { GameModule, GamePlayerId } from '@huddle/game-core';

/**
 * Trivia: the first Game Module, and the reason the interface exists.
 *
 * What is here is the module — the shape the hub holds a game by. The game
 * itself arrives task by task through Phase 3 and 4
 * (docs/implementation-plan.md): the reducer and its flat scoring, the four
 * answer buttons on the phone, the question and reveal screens on the TV, and
 * then the Question Packs and settings. Until each of those lands, this file
 * says so rather than guessing at them, because a placeholder that plays a
 * pretend game is harder to replace than one that plays none.
 */

/**
 * A game of trivia in progress.
 *
 * Today it is the players it was started with, which is the part of the state
 * that does not depend on rules nobody has written yet — trivia scores by
 * player, so this is the list every later field will be keyed by. The questions,
 * the current index, the answers and the scores land with the reducer task.
 */
export type TriviaState = {
  /** Everyone playing, in roster order. */
  readonly playerIds: readonly GamePlayerId[];
};

/**
 * The trivia Game Module.
 *
 * Its settings schema is empty and its `reduce` has nothing to rule on because
 * trivia has no events yet: the phone's answer is the first one, and it arrives
 * with the reducer. Both are the interface's honest zero, not a stub — a game
 * with no host-tunable options is a legal game, and a reducer handed an event
 * it has no rule for returns the state it was given.
 */
export const triviaGameModule: GameModule<TriviaState> = {
  metadata: {
    id: 'trivia',
    title: 'Trivia',
    /**
     * Punch, because the accents are spoken for elsewhere and this one is
     * spoken for least: cobalt is the focused card's own offset shadow
     * (docs/design/design-handoff.md §6) and a block would sit on top of it,
     * tangerine is the brand's, green is presence, yellow is the chip printed
     * on the card itself. Its Bungee title sets in ink.
     */
    keyArt: { color: 'punch' },
    /** The scope's "2–10 players", the second of which is a full room. */
    playerRange: { min: 2, max: 10 },
    /**
     * Ten questions — Phase 4's default count — at a 20-second countdown and a
     * five-second reveal apiece, plus the victory screen: about five minutes.
     * The handoff's "~12 min" chip is mock filler; the chip draws whatever the
     * module declares, and this is the number the scoped settings produce.
     */
    estimatedMinutes: 5,
    /** The genre chip. Not one of a Question Pack's categories. */
    category: 'Knowledge',
  },
  settingsSchema: [],
  createInitialState: ({ players }) => ({
    playerIds: players.map((player) => player.playerId),
  }),
  reduce: (state) => state,
  screens: {
    // The TV question, reveal and scoreboard screens, and the phone's four
    // answer buttons, are their own tasks later in Phase 3. A game that draws
    // nothing is what "not yet" looks like from the hub.
    tv: () => null,
    controller: () => null,
  },
};
