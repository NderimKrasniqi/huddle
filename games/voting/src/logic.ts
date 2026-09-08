import type {
  GameDeadline,
  GameLogic,
  GamePlayerId,
  GameSettings,
} from '@huddle/domain';

import { votingMetadata } from './metadata';
import { promptsFor } from './prompts';
import { votingEventSchema, votingStateSchema } from './schemas';
import {
  INTRO_SECONDS,
  NO_TIMER_SAFETY_MS,
  playersCounted,
  REVEAL_SECONDS,
  tallyVotes,
  votesIn,
  votingBeat,
} from './state';
import {
  votingSettings,
  VOTING_SETTINGS_PRESENTATION,
  VOTING_SETTINGS_SCHEMA,
} from './settings';
import type {
  PlayableVotingState,
  VotingAdvance,
  VotingEvent,
  VotingRecapItem,
  VotingState,
} from './types';

export {
  INTRO_SECONDS,
  NO_TIMER_SAFETY_MS,
  playersCounted,
  REVEAL_SECONDS,
  tallyVotes,
  votesIn,
  votingBeat,
} from './state';
export { votingEventSchema, votingStateSchema } from './schemas';
export type {
  LegacyVotingState,
  PlayableVotingState,
  VotingAdvance,
  VotingEvent,
  VotingPhase,
  VotingRecapItem,
  VotingRoundResult,
  VotingState,
} from './types';

const WITHHELD_PROMPT = {
  text: '',
  options: ['', '', '', ''] as const,
};

function playable(state: VotingState): PlayableVotingState | undefined {
  return state.phase === 'entered' ? undefined : state;
}

function reveal(state: PlayableVotingState): PlayableVotingState {
  if (state.phase !== 'vote') return state;
  return {
    ...state,
    phase: 'reveal',
    history: [
      ...state.history,
      { promptIndex: state.roundIndex, counts: tallyVotes(state.votes) },
    ],
  };
}

function takeVote(
  state: PlayableVotingState,
  event: Extract<VotingEvent, { kind: 'vote' }>,
): PlayableVotingState {
  if (
    state.phase !== 'vote' ||
    event.roundIndex !== state.roundIndex ||
    !state.playerIds.includes(event.playerId) ||
    Object.hasOwn(state.votes, event.playerId) ||
    !Number.isInteger(event.optionIndex) ||
    event.optionIndex < 0 ||
    event.optionIndex > 3
  ) {
    return state;
  }

  const voted = { ...state, votes: { ...state.votes, [event.playerId]: event.optionIndex } };
  const counted = playersCounted(voted, event.awayPlayerIds);
  return counted > 0 && votesIn(voted) === counted ? reveal(voted) : voted;
}

function advance(
  state: PlayableVotingState,
  event: Extract<VotingEvent, { kind: 'advance' }>,
): PlayableVotingState {
  if (event.playerId !== undefined) return state;
  if (event.roundIndex !== state.roundIndex || event.phase !== state.phase) return state;

  switch (state.phase) {
    case 'intro':
      return { ...state, phase: 'vote' };
    case 'vote':
      return reveal(state);
    case 'reveal': {
      const nextRound = state.roundIndex + 1;
      return nextRound < state.prompts.length
        ? {
            ...state,
            phase: 'vote',
            roundIndex: nextRound,
            votes: {},
            participationCount: undefined,
            tally: undefined,
            revealedVoters: undefined,
            recap: undefined,
          }
        : { ...state, phase: 'finished', votes: {} };
    }
    case 'finished':
      return state;
  }
}

function promptsForViewer(
  state: PlayableVotingState,
  viewer: GamePlayerId | undefined,
): PlayableVotingState['prompts'] {
  const showCurrent = state.phase === 'vote' || (state.phase === 'reveal' && viewer === undefined);
  return state.prompts.map((prompt, index) =>
    showCurrent && index === state.roundIndex ? prompt : WITHHELD_PROMPT,
  );
}

function votersByOption(state: PlayableVotingState): readonly (readonly GamePlayerId[])[] {
  const groups: GamePlayerId[][] = [[], [], [], []];
  for (const [playerId, optionIndex] of Object.entries(state.votes)) {
    if (optionIndex >= 0 && optionIndex < groups.length) groups[optionIndex]!.push(playerId);
  }
  return groups;
}

function optionWithCount(
  state: PlayableVotingState,
  resultIndex: number,
  optionIndex: number,
): { readonly option: string; readonly count: number } {
  const result = state.history[resultIndex];
  const prompt = result === undefined ? undefined : state.prompts[result.promptIndex];
  return {
    option: prompt?.options[optionIndex] ?? 'A room favorite',
    count: result?.counts[optionIndex] ?? 0,
  };
}

/** Aggregate-only recap: no winner, score, rank, or player-to-choice mapping. */
export function votingRecap(state: PlayableVotingState): readonly VotingRecapItem[] {
  if (state.history.length === 0) return [];

  const ranked = state.history
    .map((result, resultIndex) => {
      const ordered = result.counts
        .map((count, optionIndex) => ({ count, optionIndex }))
        .sort((first, second) => second.count - first.count || first.optionIndex - second.optionIndex);
      const total = result.counts.reduce((sum, count) => sum + count, 0);
      return {
        resultIndex,
        total,
        top: ordered[0]!,
        second: ordered[1]!,
        share: total === 0 ? 0 : ordered[0]!.count / total,
        gap: ordered[0]!.count - ordered[1]!.count,
      };
    })
    .filter(({ total }) => total > 0);
  if (ranked.length === 0) return [];

  const agreement = [...ranked].sort(
    (first, second) => second.share - first.share || second.top.count - first.top.count || first.resultIndex - second.resultIndex,
  )[0]!;
  const closest = [...ranked].sort(
    (first, second) => first.gap - second.gap || second.total - first.total || first.resultIndex - second.resultIndex,
  )[0]!;
  const minorities = state.history.flatMap((result, resultIndex) =>
    result.counts
      .map((count, optionIndex) => ({ resultIndex, optionIndex, count }))
      .filter(({ count }) => count > 0),
  );
  const wildcard = minorities.sort(
    (first, second) => first.count - second.count || second.resultIndex - first.resultIndex || first.optionIndex - second.optionIndex,
  )[0] ?? { resultIndex: agreement.resultIndex, optionIndex: agreement.top.optionIndex, count: agreement.top.count };

  const agreementChoice = optionWithCount(state, agreement.resultIndex, agreement.top.optionIndex);
  const closestFirst = optionWithCount(state, closest.resultIndex, closest.top.optionIndex);
  const closestSecond = optionWithCount(state, closest.resultIndex, closest.second.optionIndex);
  const wildcardChoice = optionWithCount(state, wildcard.resultIndex, wildcard.optionIndex);

  return [
    {
      kind: 'agreement',
      title: 'Strongest agreement',
      detail: `${agreementChoice.option} brought the room together`,
      value: `${agreementChoice.count} of ${agreement.total}`,
    },
    {
      kind: 'closest',
      title: 'Closest call',
      detail: `${closestFirst.option} and ${closestSecond.option} split the room`,
      value: `${closest.top.count}–${closest.second.count}`,
    },
    {
      kind: 'wildcard',
      title: 'Wildcard',
      detail: `${wildcardChoice.option} surprised the room`,
      value: `${wildcardChoice.count} vote${wildcardChoice.count === 1 ? '' : 's'}`,
    },
  ];
}

/** Project state for one phone or the presentation-only TV without leaking raw votes. */
export function redactVotingStateFor(
  state: VotingState,
  viewer: GamePlayerId | undefined,
): VotingState {
  const current = playable(state);
  if (current === undefined) return state;

  const isTv = viewer === undefined;
  const votes =
    current.phase === 'vote' && viewer !== undefined && Object.hasOwn(current.votes, viewer)
      ? { [viewer]: current.votes[viewer]! }
      : {};
  const showTally = isTv && (
    current.phase === 'reveal' ||
    (current.phase === 'vote' && current.results === 'live')
  );

  return {
    ...current,
    prompts: promptsForViewer(current, viewer),
    votes,
    // Prior round aggregates are internal recap inputs. Clients receive only
    // the phase-specific normalized tally or final recap they actually draw.
    history: [],
    participationCount:
      current.phase === 'vote' || (isTv && current.phase === 'reveal')
        ? votesIn(current)
        : undefined,
    tally: showTally ? tallyVotes(current.votes) : undefined,
    revealedVoters:
      isTv && current.phase === 'reveal' && current.voterLabels === 'afterReveal'
        ? votersByOption(current)
        : undefined,
    recap: isTv && current.phase === 'finished' ? votingRecap(current) : undefined,
  };
}

export const votingGameLogic: GameLogic<VotingState, VotingEvent, GameSettings> = {
  stateVersion: 2,
  decodeState: (value) => votingStateSchema.parse(value) as VotingState,
  decodeEvent: (value) => votingEventSchema.parse(value) as VotingEvent,
  metadata: votingMetadata,
  settingsSchema: VOTING_SETTINGS_SCHEMA,
  settingsPresentation: VOTING_SETTINGS_PRESENTATION,
  createInitialState: ({ players, settings }) => {
    const selected = votingSettings(settings);
    const playerIds = players.map(({ playerId }) => playerId);
    return {
      prompts: promptsFor(selected.rounds, playerIds),
      roundIndex: 0,
      phase: 'intro',
      voteSeconds: selected.voteSeconds,
      results: selected.results,
      voterLabels: selected.voterLabels,
      playerIds,
      votes: {},
      history: [],
    };
  },
  reduce: (state, event) => {
    const current = playable(state);
    if (current === undefined) return state;
    return event.kind === 'vote' ? takeVote(current, event) : advance(current, event);
  },
  deadline: (state) => introDeadline(state) ?? voteDeadline(state) ?? revealDeadline(state),
  redactStateFor: redactVotingStateFor,
  isFinished: (state) => state.phase !== 'entered' && state.phase === 'finished',
  finishedSummary: (state) => ({
    title: state.phase !== 'entered' && state.phase === 'finished' ? 'That’s the room’s vibe' : 'Voting',
    subtitle: 'A shared recap with no scores or winners.',
  }),
};

export function introDeadline(state: VotingState): GameDeadline<VotingAdvance> | undefined {
  if (state.phase === 'entered' || state.phase !== 'intro') return undefined;
  return {
    beat: votingBeat(state),
    afterMs: INTRO_SECONDS * 1000,
    event: { kind: 'advance', roundIndex: state.roundIndex, phase: 'intro' },
  };
}

export function voteDeadline(state: VotingState): GameDeadline<VotingAdvance> | undefined {
  if (state.phase === 'entered' || state.phase !== 'vote') return undefined;
  return {
    beat: votingBeat(state),
    afterMs: state.voteSeconds === 'none' ? NO_TIMER_SAFETY_MS : state.voteSeconds * 1000,
    event: { kind: 'advance', roundIndex: state.roundIndex, phase: 'vote' },
  };
}

export function revealDeadline(state: VotingState): GameDeadline<VotingAdvance> | undefined {
  if (state.phase === 'entered' || state.phase !== 'reveal') return undefined;
  return {
    beat: votingBeat(state),
    afterMs: REVEAL_SECONDS * 1000,
    event: { kind: 'advance', roundIndex: state.roundIndex, phase: 'reveal' },
  };
}
