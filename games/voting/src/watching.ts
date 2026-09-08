import type { GamePlayer, GamePlayerId } from '@huddle/domain';

import { playableVotingState } from './state';
import type { VotingRecapItem, VotingState } from './types';

export type VotingTallyOption = {
  readonly optionIndex: number;
  readonly text: string;
  readonly count: number | undefined;
  readonly percent: number | undefined;
  readonly voters: readonly {
    readonly playerId: GamePlayerId;
    readonly nickname: string;
    readonly avatar: GamePlayer['avatar'] | undefined;
  }[];
};

export type VotingTvModel =
  | { readonly kind: 'legacy'; readonly rounds: 3 | 5 }
  | {
      readonly kind: 'intro';
      readonly rounds: number;
      readonly playerCount: number;
      readonly voteSeconds: number | 'none';
      readonly results: 'together' | 'live';
      readonly voterLabels: 'hidden' | 'afterReveal';
    }
  | {
      readonly kind: 'vote';
      readonly roundIndex: number;
      readonly roundCount: number;
      readonly text: string;
      readonly options: readonly VotingTallyOption[];
      readonly voted: number;
      readonly playerCount: number;
      readonly countdownSeconds: number | undefined;
      readonly live: boolean;
    }
  | {
      readonly kind: 'reveal';
      readonly roundIndex: number;
      readonly roundCount: number;
      readonly text: string;
      readonly options: readonly VotingTallyOption[];
      readonly voted: number;
      readonly playerCount: number;
      readonly labelsShown: boolean;
    }
  | { readonly kind: 'finished'; readonly recap: readonly VotingRecapItem[] };

function rosterIndex(players: readonly GamePlayer[]): Map<GamePlayerId, GamePlayer> {
  return new Map(players.map((player) => [player.playerId, player]));
}

function optionsFor(
  state: Exclude<VotingState, { phase: 'entered' }>,
  players: readonly GamePlayer[],
  showCounts: boolean,
  showLabels: boolean,
): readonly VotingTallyOption[] {
  const prompt = state.prompts[state.roundIndex];
  const counts = state.tally;
  const total = counts?.reduce((sum, count) => sum + count, 0) ?? 0;
  const roster = rosterIndex(players);
  return (prompt?.options ?? ['', '', '', '']).map((text, optionIndex) => ({
    optionIndex,
    text,
    // Fail closed: never reconstruct aggregate results from `votes`.
    count: showCounts ? counts?.[optionIndex] ?? 0 : undefined,
    percent: showCounts ? (total === 0 ? 0 : Math.round(((counts?.[optionIndex] ?? 0) / total) * 100)) : undefined,
    voters: showLabels
      ? (state.revealedVoters?.[optionIndex] ?? []).map((playerId) => ({
          playerId,
          nickname: roster.get(playerId)?.nickname ?? 'Player',
          avatar: roster.get(playerId)?.avatar,
        }))
      : [],
  }));
}

export function votingTvModel(
  state: VotingState,
  players: readonly GamePlayer[],
  clockRemainingMs?: number,
): VotingTvModel {
  const current = playableVotingState(state);
  if (current === undefined) {
    return {
      kind: 'legacy',
      rounds: state.phase === 'entered' ? state.resolvedSettings.rounds : 5,
    };
  }
  if (current.phase === 'intro') {
    return {
      kind: 'intro',
      rounds: current.prompts.length,
      playerCount: current.playerIds.length,
      voteSeconds: current.voteSeconds,
      results: current.results,
      voterLabels: current.voterLabels,
    };
  }
  if (current.phase === 'finished') return { kind: 'finished', recap: current.recap ?? [] };

  const prompt = current.prompts[current.roundIndex];
  const voted = current.participationCount ?? 0;
  const playerCount = current.playerIds.length;
  if (current.phase === 'reveal') {
    return {
      kind: 'reveal',
      roundIndex: current.roundIndex,
      roundCount: current.prompts.length,
      text: prompt?.text ?? '',
      options: optionsFor(current, players, true, current.voterLabels === 'afterReveal'),
      voted,
      playerCount,
      labelsShown: current.voterLabels === 'afterReveal' && current.revealedVoters !== undefined,
    };
  }

  return {
    kind: 'vote',
    roundIndex: current.roundIndex,
    roundCount: current.prompts.length,
    text: prompt?.text ?? '',
    options: optionsFor(current, players, current.results === 'live', false),
    voted,
    playerCount,
    countdownSeconds:
      current.voteSeconds === 'none'
        ? undefined
        : clockRemainingMs !== undefined && Number.isFinite(clockRemainingMs)
          ? Math.max(0, Math.ceil(clockRemainingMs / 1000))
          : current.voteSeconds,
    live: current.results === 'live',
  };
}
