import type { GameDeadline, GamePlayerId } from '@huddle/game-core';

import type { TriviaAdvance, TriviaState } from './logic';

/**
 * Trivia's state constants and the pure reads over it — the half of the rules a
 * client may hold.
 *
 * These are the selectors and rule-clocks the TV and Controller screens draw
 * from: the answered and expected counts, the beat a clock keys off, and the
 * Reveal Beat a phone sends. Each one touches nothing but the state it is handed,
 * so it lives apart from `./logic`, which imports the Question Pack to *deal* a
 * game. A screen that imported a value from `./logic` would pull `./questions`,
 * and the pack's every answer with it, into the client bundle — where a modified
 * client could reproduce the deterministic deal (docs/implementation-plan.md
 * 5.9). So the screens read these from here; `./logic` imports them back for the
 * rules' own use and re-exports them, so the server and the tests go on reading
 * them off the module they always have.
 *
 * The types come from `./logic` as *types*, which erase, so this module has no
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
 * What a clock is set for. Both of trivia's — the room's Question Timer and the
 * phones' Reveal Beat — key off this one function, so "the same beat" means one
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

/**
 * The beat that ends a Reveal, addressed and timed — or nothing, on a beat that
 * ends by itself.
 *
 * This is the room's clock, and it is here rather than in the screen that runs
 * it for one reason: it is the only thing in trivia that moves the room from
 * one question to the next, and a mistake in it does not fail loudly. An
 * `advance` addressed to the wrong beat is *inert by design* — the reducer
 * returns the state untouched and the hub skips the write — so getting this
 * wrong does not throw, does not log, and does not fail a renderer test. It
 * hangs the reveal forever. Deciding it here is what lets it be asserted.
 *
 * Who sends it is the screen's business (`./controller-screen`), and the answer
 * is "every playing phone": the event is addressed to the beat it ends, so the
 * first to arrive moves the room and the rest do nothing at all.
 */
export function revealBeat(
  state: TriviaState,
  playerId: GamePlayerId,
): GameDeadline<TriviaAdvance> | undefined {
  if (state.phase !== 'reveal') {
    return undefined;
  }

  return {
    beat: beatOf(state),
    afterMs: REVEAL_SECONDS * 1000,
    event: {
      kind: 'advance',
      playerId,
      // The beat on screen now — not the one that will be up when the timer
      // fires, which is exactly what makes a late send harmless.
      questionIndex: state.questionIndex,
      phase: 'reveal',
    },
  };
}
