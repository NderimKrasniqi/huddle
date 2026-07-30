import type { GamePlayer, GamePlayerId } from '@huddle/game-core';

import { QUESTION_SECONDS, type TriviaState } from './logic';

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

/**
 * One row of the Victory Screen: a scoreboard row and where it finished.
 *
 * The rank is decided here rather than on the screen for the reason the
 * standings' *order* is decided in the rules: it is one answer to "who won",
 * and a renderer working it out is a renderer that can disagree with the next
 * one to draw it.
 */
export type FinalStanding = ScoreRow & {
  /**
   * Competition rank, so ties share the top one (docs/CONTEXT.md, Victory
   * Screen): two players level on the highest score are both 1st, and the
   * player behind them is 3rd — the rank they took between them is spent.
   */
  readonly rank: number;
  /** Took the top rank. More than one of these is a game that tied. */
  readonly winner: boolean;
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
      /**
       * How long the room gets on this question — the length of the countdown,
       * not what is left of it.
       *
       * What is left is the television's own count, because the room's clock is
       * the server's (see `questionTimer`) and a TV reading a server timestamp
       * would be reading it against a television's clock. So the rules say how
       * many seconds, the screen counts them from the moment it is handed the
       * question, and the reveal arriving is what ends the count — never the
       * count itself.
       */
      readonly countdownSeconds: number;
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
  /** The Victory Screen: who won, and where everybody finished. */
  | {
      readonly kind: 'finished';
      /** The celebration, in words: the winner's name, or that nobody won alone. */
      readonly headline: string;
      readonly standings: readonly FinalStanding[];
    };

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

/**
 * The scoreboard with everybody's place on it.
 *
 * The order is the standings' own, untouched — the ranks are read off it rather
 * than sorted for, which is what keeps the Victory Screen and the running
 * scoreboard telling one story. A rank starts wherever a new score first
 * appears, so equal scores keep the rank of the first of them and the run of
 * ranks they used up is skipped: 1, 1, 3.
 */
function finalStandings(state: TriviaState, players: readonly GamePlayer[]): readonly FinalStanding[] {
  let rank = 0;
  let scoreAtRank: number | undefined;

  return scoreboardOf(state, players).map((row, index) => {
    if (row.score !== scoreAtRank) {
      rank = index + 1;
      scoreAtRank = row.score;
    }

    return { ...row, rank, winner: rank === 1 };
  });
}

/**
 * What the Victory Screen says out loud.
 *
 * A tie is not named player by player: with ten seats a room can tie any number
 * of ways — everybody wrong on every question ties all ten on nothing — and a
 * headline that listed them would be a paragraph rather than a celebration.
 */
function victoryHeadline(standings: readonly FinalStanding[]): string {
  const winners = standings.filter((standing) => standing.winner);
  const [first] = winners;

  // Nobody played, which a game of trivia cannot be — it needs two seats to
  // start. The honest line rather than a crown with no head under it.
  if (first === undefined) {
    return 'Game over';
  }

  return winners.length === 1 ? `${first.nickname} wins!` : 'It’s a tie!';
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
    const standings = finalStandings(state, players);

    return { kind: 'finished', headline: victoryHeadline(standings), standings };
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
    countdownSeconds: QUESTION_SECONDS,
  };
}
