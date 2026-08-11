import type { GamePlayerId } from '@huddle/game-core';

import type { TriviaState } from './types';

/**
 * Trivia's state constants and the pure reads over it — the half of the rules a
 * client may hold.
 *
 * These are the selectors and rule-clocks the TV and Controller screens draw
 * from: the answered and expected counts and the beat a clock keys off. Each
 * one touches nothing but the state it is handed,
 * so it lives apart from `./logic`, which imports the Question Pack to *deal* a
 * game. A screen that imported a value from `./logic` would pull `./questions`,
 * and the pack's every answer with it, into the client bundle — where a modified
 * client could reproduce the deterministic deal (docs/implementation-plan.md
 * 5.9). So the screens read these from here; `./logic` imports them back for the
 * rules' own use and re-exports them, so the server and the tests go on reading
 * them off the module they always have.
 *
 * The types come from `./types` as *types*, which erase, so this module has no
 * runtime import of it and therefore no path to the pack — which is the whole
 * point of the seam.
 */

/**
 * How long a question stays up before the room stops waiting for it — the
 * plan's pinned twenty seconds, counted down on the television.
 *
 * A rule of the game like `REVEAL_SECONDS`, and the same number twice over: the
 * room's clock runs on it (`questionTimer`) and the TV's countdown draws it, so
 * a countdown that reached zero while the question was still live would be two
 * numbers that had drifted rather than one rule.
 */
export const QUESTION_SECONDS = 20;

/**
 * How long the Reveal stays up before the room moves to the next question.
 *
 * A rule of the game rather than a fact about either screen, so it is here with
 * the rest of them: the phones count it down and the television draws for that
 * long, and the two cannot be counting different numbers.
 */
export const REVEAL_SECONDS = 5;

/**
 * The beat a state is on, named: which question, and which half of it.
 *
 * What a clock is set for. Both of trivia's server-owned timers key off this one
 * function, so "the same beat" means one
 * thing however it is being timed, and the hub can tell whether a state it has
 * just written started a new one (`GameDeadline`).
 */
export function beatOf(state: TriviaState): string {
  return `${state.questionIndex}:${state.phase}`;
}

/**
 * How many players the current question is counted against — the "3/5 answered"
 * denominator: everyone the room is still hearing from, plus anyone already in.
 *
 * Away is subtracted because a room cannot be waiting for a phone it has
 * stopped hearing from (a game never waits for an away
 * player), and an answer already given is added back because it is already
 * given: a count that dropped a player the moment their phone went quiet would
 * be the television losing an answer the room has.
 *
 * Who is Away is the room's and arrives with the event (`TriviaEvent`), so a
 * room that said nothing is a room with nobody away — the whole scoreboard, and
 * what trivia waited for before it was ever told.
 *
 * It lives with the rules rather than on the screen because it *is* the rule
 * the reveal turns on: the question ends when this many answers are in
 * (`answersIn`), so the chip reading `n/n` and the reveal happening are one
 * fact and not two that agree. The television reads it off the roster it is
 * handed (`TvGameScreenProps`) and the reducer off the away list it is handed,
 * and neither can arrive at a different number from the same room.
 */
export function playersCounted(
  state: TriviaState,
  awayPlayerIds: readonly GamePlayerId[] | undefined,
): number {
  const away = new Set(awayPlayerIds);

  return state.standings.filter(
    (standing) =>
      !away.has(standing.playerId) || Object.hasOwn(state.answers, standing.playerId),
  ).length;
}

/** How many of the current question's answers are in: the chip's numerator. */
export function answersIn(state: TriviaState): number {
  return state.standings.filter((standing) => Object.hasOwn(state.answers, standing.playerId))
    .length;
}
