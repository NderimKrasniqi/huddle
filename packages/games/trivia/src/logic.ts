import type { GameLogic, GamePlayerId } from '@huddle/game-core';

/**
 * Trivia's rules, with no screens attached.
 *
 * This is the half that runs inside a Convex mutation, which is why it is its
 * own module and its own package entry point (`@huddle/game-trivia/logic`): the
 * server seeds a game's state and reduces its events, and must not carry the
 * React Native that draws it. `./trivia` is where the screens are put back on
 * top for the two clients.
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
 * Trivia's metadata, settings schema and rules.
 *
 * Its settings schema is empty and its `reduce` has nothing to rule on because
 * trivia has no events yet: the phone's answer is the first one, and it arrives
 * with the reducer task. Both are the interface's honest zero, not a stub — a
 * game with no host-tunable options is a legal game, and a reducer handed an
 * event it has no rule for returns the state it was given.
 */
export const triviaGameLogic: GameLogic<TriviaState> = {
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
};
