import type { GamePlayer, GamePlayerId } from '@huddle/game-core';

import type { TriviaState } from './logic';

/**
 * The television as data: what the room is looking at, given the state the room
 * is in.
 *
 * The counterpart to `./answering`, and split from its renderer for the same
 * reason — this is where what the TV shows can be tested, because the drawing
 * of it cannot be (docs/tech-stack.md). `./tv-screen.tsx` is this drawn.
 *
 * The television is a pure renderer: it holds no player record and sends
 * nothing. Everything below is a function of the room's state and its roster,
 * which is the whole of what the TV is given (`TvGameScreenProps`).
 */

/** One option as the television draws it. */
export type WatchedOption = {
  readonly optionIndex: number;
  readonly text: string;
  /** Only known at the Reveal — before it, the TV must not give it away. */
  readonly correct: boolean | undefined;
};

/** How one player did on the question just revealed. */
export type PlayerVerdict = {
  readonly playerId: GamePlayerId;
  readonly nickname: string;
  /** Their claimed color, for the name pill; absent until they claim one. */
  readonly color: GamePlayer['color'];
  /** False for a wrong answer *and* for no answer, which score the same. */
  readonly correct: boolean;
};

/** One row of the running scoreboard, in the standings' own order. */
export type ScoreRow = {
  readonly playerId: GamePlayerId;
  readonly nickname: string;
  readonly color: GamePlayer['color'];
  readonly score: number;
};

export type WatchedScreen =
  /** A question is up and the room is answering it. */
  | {
      readonly kind: 'question';
      readonly questionNumber: number;
      readonly questionCount: number;
      readonly text: string;
      readonly options: readonly WatchedOption[];
      /** The "3/5 answered" chip: how many are in, out of how many are playing. */
      readonly answered: number;
      readonly playerCount: number;
    }
  /** The answer, who got it, and where that leaves everybody. */
  | {
      readonly kind: 'reveal';
      readonly questionNumber: number;
      readonly questionCount: number;
      readonly text: string;
      readonly options: readonly WatchedOption[];
      readonly verdicts: readonly PlayerVerdict[];
      readonly scoreboard: readonly ScoreRow[];
    }
  /** The game is over; the Victory Screen is its own task. */
  | { readonly kind: 'finished'; readonly scoreboard: readonly ScoreRow[] };

/**
 * The roster as a lookup, so a scoreboard of ten does not scan the roster ten
 * times. A player in the standings but no longer on the roster (they left
 * mid-game) keeps their score and their place — the game they played is not
 * rewritten by their leaving — and is drawn under the name the game has.
 */
function rosterIndex(players: readonly GamePlayer[]): Map<GamePlayerId, GamePlayer> {
  return new Map(players.map((player) => [player.playerId, player]));
}

function scoreboardOf(state: TriviaState, players: readonly GamePlayer[]): readonly ScoreRow[] {
  const roster = rosterIndex(players);

  // The standings' order, untouched: they are already in scoreboard order, and
  // sorting them again here is how two screens start disagreeing about who is
  // winning (see `TriviaStanding`).
  return state.standings.map((standing) => {
    const seated = roster.get(standing.playerId);

    return {
      playerId: standing.playerId,
      nickname: seated?.nickname ?? 'Player',
      color: seated?.color,
      score: standing.score,
    };
  });
}

function optionsOf(
  question: { readonly options: readonly string[]; readonly correctIndex: number },
  revealed: boolean,
): readonly WatchedOption[] {
  return question.options.map((text, optionIndex) => ({
    optionIndex,
    text,
    // `undefined` rather than `false` while the question is up: the TV does not
    // know which is right yet, and a `false` here would be the screen claiming
    // it does.
    correct: revealed ? optionIndex === question.correctIndex : undefined,
  }));
}

function verdictsOf(
  state: TriviaState,
  question: { readonly correctIndex: number },
  players: readonly GamePlayer[],
): readonly PlayerVerdict[] {
  const roster = rosterIndex(players);

  return state.standings.map((standing) => {
    const seated = roster.get(standing.playerId);

    return {
      playerId: standing.playerId,
      nickname: seated?.nickname ?? 'Player',
      color: seated?.color,
      // A player who never answered is not in `answers`, and is wrong — the
      // same as answering wrongly, which is what the scoring says too.
      correct: state.answers[standing.playerId] === question.correctIndex,
    };
  });
}

/** What the television draws for the game as it stands. */
export function watchedScreen(
  state: TriviaState,
  players: readonly GamePlayer[],
): WatchedScreen {
  const question = state.questions[state.questionIndex];

  // A finished game, and — as in `answerScreen` — a question index past the end
  // of the questions, which is the type system's question and not the game's.
  if (state.phase === 'finished' || question === undefined) {
    return { kind: 'finished', scoreboard: scoreboardOf(state, players) };
  }

  const questionNumber = state.questionIndex + 1;
  const questionCount = state.questions.length;

  if (state.phase === 'reveal') {
    return {
      kind: 'reveal',
      questionNumber,
      questionCount,
      text: question.text,
      options: optionsOf(question, true),
      verdicts: verdictsOf(state, question, players),
      scoreboard: scoreboardOf(state, players),
    };
  }

  return {
    kind: 'question',
    questionNumber,
    questionCount,
    text: question.text,
    options: optionsOf(question, false),
    // Counted off the standings rather than the roster: the standings are who
    // is *playing*, and a phone that joined mid-game is seated without being in
    // the game it walked in on.
    answered: state.standings.filter((standing) =>
      Object.hasOwn(state.answers, standing.playerId),
    ).length,
    playerCount: state.standings.length,
  };
}
