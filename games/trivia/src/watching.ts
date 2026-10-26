import type { GamePlayer, GamePlayerId } from '@huddle/domain';

import type { TriviaState } from './types';
import { QUESTION_SECONDS } from './state';

export type WatchedOption = {
  readonly optionIndex: number;
  readonly text: string;
  readonly correct: boolean | undefined;
};

type PlayerVerdict = {
  readonly playerId: GamePlayerId;
  readonly nickname: string;
  readonly avatar: GamePlayer['avatar'] | undefined;
  readonly correct: boolean;
};

type ScoreRow = {
  readonly playerId: GamePlayerId;
  readonly nickname: string;
  readonly avatar: GamePlayer['avatar'] | undefined;
  readonly score: number;
  readonly away: boolean;
  readonly gain?: number;
};

export type FinalStanding = ScoreRow & {
  readonly rank: number;
  readonly winner: boolean;
};

export type WatchedScreen =
  | {
      readonly kind: 'intro';
      readonly questionCount: number;
      readonly playerCount: number;
    }
  | {
      readonly kind: 'question';
      readonly questionNumber: number;
      readonly questionCount: number;
      readonly category: string | undefined;
      readonly text: string;
      readonly options: readonly WatchedOption[];
      readonly answered: number;
      readonly playerCount: number;
      readonly countdownSeconds: number;
    }
  | {
      readonly kind: 'reveal';
      readonly questionNumber: number;
      readonly questionCount: number;
      readonly text: string;
      readonly options: readonly WatchedOption[];
      readonly verdicts: readonly PlayerVerdict[];
      readonly scoreboard: readonly ScoreRow[];
    }
  | {
      readonly kind: 'finished';
      readonly headline: string;
      readonly standings: readonly FinalStanding[];
    };

function rosterIndex(players: readonly GamePlayer[]): Map<GamePlayerId, GamePlayer> {
  return new Map(players.map((player) => [player.playerId, player]));
}

function scoreboardOf(
  state: TriviaState,
  players: readonly GamePlayer[],
): readonly ScoreRow[] {
  const roster = rosterIndex(players);

  return state.standings.map((standing) => {
    const seated = roster.get(standing.playerId);

    return {
      playerId: standing.playerId,
      nickname: seated?.nickname ?? 'Player',
      avatar: seated?.avatar,
      score: standing.score,
      away: seated?.away ?? false,
      gain: state.revealGains?.[standing.playerId],
    };
  });
}

function finalStandings(
  state: TriviaState,
  players: readonly GamePlayer[],
): readonly FinalStanding[] {
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

function victoryHeadline(standings: readonly FinalStanding[]): string {
  const winners = standings.filter((standing) => standing.winner);
  const [first] = winners;

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
    correct: revealed ? optionIndex === question.correctIndex : undefined,
  }));
}

function verdictsOf(
  state: TriviaState,
  players: readonly GamePlayer[],
): readonly PlayerVerdict[] {
  const roster = rosterIndex(players);

  return state.standings.map((standing) => {
    const seated = roster.get(standing.playerId);

    return {
      playerId: standing.playerId,
      nickname: seated?.nickname ?? 'Player',
      avatar: seated?.avatar,
      correct: state.revealVerdicts?.[standing.playerId] === true,
    };
  });
}

export function watchedScreen(
  state: TriviaState,
  players: readonly GamePlayer[],
  clockRemainingMs?: number,
): WatchedScreen {
  const current = state;

  if (current.phase === 'intro') {
    return {
      kind: 'intro',
      questionCount: current.questions.length,
      playerCount: current.standings.length,
    };
  }

  const question = current.questions[current.questionIndex];

  if (current.phase === 'finished' || question === undefined) {
    const standings = finalStandings(current, players);

    return { kind: 'finished', headline: victoryHeadline(standings), standings };
  }

  const questionNumber = current.questionIndex + 1;
  const questionCount = current.questions.length;

  if (current.phase === 'reveal') {
    return {
      kind: 'reveal',
      questionNumber,
      questionCount,
      text: question.text,
      options: optionsOf(question, true),
      verdicts: verdictsOf(current, players),
      scoreboard: scoreboardOf(current, players),
    };
  }

  return {
    kind: 'question',
    questionNumber,
    questionCount,
    category: question.category,
    text: question.text,
    options: optionsOf(question, false),
    answered: current.participationCount ?? 0,
    playerCount: current.standings.length,
    countdownSeconds:
      clockRemainingMs !== undefined && Number.isFinite(clockRemainingMs)
        ? Math.max(0, Math.ceil(clockRemainingMs / 1000))
        : current.questionSeconds ?? QUESTION_SECONDS,
  };
}
