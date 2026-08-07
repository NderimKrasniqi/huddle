import type { GamePlayer, GamePlayerId } from '@huddle/game-core';

import { playersCounted, VOTE_SECONDS, votesIn, type VotingState } from './logic';

/**
 * The television as data: what the room is looking at, given the state the room
 * is in.
 *
 * The counterpart to `./voting-controller`, and split from its renderer for the
 * same reason — this is where what the TV shows can be tested, because the
 * drawing of it cannot be (docs/tech-stack.md). `./tv-screen.tsx` is this drawn.
 *
 * The television is a pure renderer: it holds no player record and sends
 * nothing. Everything below is a function of the room's state and its roster,
 * which is the whole of what the TV is given (`TvGameScreenProps`).
 *
 * The count is held back until the reveal here as well as in the state: while a
 * prompt is open the TV shows only how many have voted, never the running
 * tally, so the room is not nudged by a leader board forming mid-vote. The state
 * makes that impossible to attribute; this makes it invisible to read.
 */

/** One option while a prompt is open — its text, and nothing about how it is doing. */
export type PromptOption = {
  readonly optionIndex: number;
  readonly text: string;
};

/** One option at the reveal — its text, its count, and whether it leads. */
export type TallyRow = {
  readonly optionIndex: number;
  readonly text: string;
  readonly count: number;
  /** Whether this option has the most votes. Several share it on a tie; none does when nobody voted. */
  readonly leading: boolean;
};

/** What the television draws while a game of Voting runs. */
export type WatchedVoteScreen =
  /** A prompt is open: the question, its options, and how many have voted. */
  | {
      readonly kind: 'voting';
      readonly promptNumber: number;
      readonly promptCount: number;
      readonly text: string;
      readonly options: readonly PromptOption[];
      /** The "voted" numerator and its denominator — the count, never the tally. */
      readonly voted: number;
      readonly playerCount: number;
      /** The Vote Timer, counted down locally from here (see the TV's `Countdown`). */
      readonly countdownSeconds: number;
    }
  /** The tally: the question and each option's count, with the leaders marked. */
  | {
      readonly kind: 'reveal';
      readonly promptNumber: number;
      readonly promptCount: number;
      readonly text: string;
      readonly rows: readonly TallyRow[];
    }
  /** The closing screen: the game is over. */
  | { readonly kind: 'finished'; readonly promptCount: number };

/** The room's away seats, as the rules count presence — derived from the roster the TV holds. */
function awayIn(players: readonly GamePlayer[]): GamePlayerId[] {
  return players.filter((player) => player.away).map((player) => player.playerId);
}

/** What the television draws for the game as it stands. */
export function watchedVoteScreen(
  state: VotingState,
  players: readonly GamePlayer[],
): WatchedVoteScreen {
  const promptCount = state.prompts.length;

  if (state.phase === 'finished') {
    return { kind: 'finished', promptCount };
  }

  const prompt = state.prompts[state.promptIndex];

  // A prompt index past the end is the type system's question, not the game's;
  // drawn as the closing screen, which is where such a state is headed.
  if (prompt === undefined) {
    return { kind: 'finished', promptCount };
  }

  // "Prompt 2 of 3": one-based for the room, which does not count from zero.
  const promptNumber = state.promptIndex + 1;

  if (state.phase === 'reveal') {
    const highest = Math.max(0, ...state.tally);

    return {
      kind: 'reveal',
      promptNumber,
      promptCount,
      text: prompt.text,
      rows: prompt.options.map((text, optionIndex) => {
        const count = state.tally[optionIndex] ?? 0;

        return {
          optionIndex,
          text,
          count,
          // Leads only when somebody voted for it: a prompt nobody answered has
          // no leader, so `highest` of zero marks none.
          leading: count > 0 && count === highest,
        };
      }),
    };
  }

  return {
    kind: 'voting',
    promptNumber,
    promptCount,
    text: prompt.text,
    options: prompt.options.map((text, optionIndex) => ({ optionIndex, text })),
    voted: votesIn(state),
    playerCount: playersCounted(state, awayIn(players)),
    countdownSeconds: VOTE_SECONDS,
  };
}
