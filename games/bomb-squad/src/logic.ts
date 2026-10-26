import type { GameDeadline, GameLogic, GamePlayerId, GameSettings } from '@huddle/domain';

import { dealRounds } from './clues';
import { bombSquadMetadata } from './metadata';
import { bombEventSchema, bombStateSchema } from './schemas';
import { BOMB_SETTINGS_SCHEMA, bombSettings } from './settings';
import { type BombAdvance, type BombEvent, type BombState, type RoundDeal, type RoundResult, type Wire, WIRES } from './types';

export { clueHolds, dealRound, dealRounds, saboteurCount } from './clues';
export { bombEventSchema, bombStateSchema } from './schemas';
export type * from './types';

export const HOW_TO_SECONDS = 45;
export const BRIEF_SECONDS = 10;
export const CUT_SECONDS = 6;
export const ACCUSE_SECONDS = 15;
export const REVEAL_SECONDS = 10;
export const DEFUSE_POINTS = 100;
export const SABOTAGE_POINTS = 150;
export const CATCH_POINTS = 50;
const ESCAPE_POINTS = 50;

const DEFAULT_SEED = 0x5eed;

function bombBeat(state: BombState): string {
  return `${state.round}:${state.phase}`;
}

function isPlaying(state: BombState, playerId: GamePlayerId): boolean {
  return state.standings.some((standing) => standing.playerId === playerId);
}

function wireCut(votes: Readonly<Record<GamePlayerId, Wire>>, tieOrder: readonly Wire[]): { cut: Wire | null; tied: boolean } {
  const tally = new Map<Wire, number>();
  for (const wire of Object.values(votes)) tally.set(wire, (tally.get(wire) ?? 0) + 1);
  const best = Math.max(0, ...tally.values());
  if (best === 0) return { cut: null, tied: false };
  const top = [...tally].filter(([, count]) => count === best).map(([wire]) => wire);
  if (top.length === 1) return { cut: top[0]!, tied: false };
  return { cut: tieOrder.find((wire) => top.includes(wire)) ?? top[0]!, tied: true };
}

function cutWire(state: BombState): BombState {
  const deal = state.rounds[state.round];
  if (deal === undefined) return state;
  const { cut, tied } = wireCut(state.votes, deal.tieOrder ?? WIRES);
  const result: RoundResult = { cut, ...(tied ? { tied } : {}), defused: cut !== null && cut === deal.safe, gains: {} };
  return { ...state, phase: 'cut', results: [...state.results, result] };
}

function roundGains(state: BombState, deal: RoundDeal, defused: boolean): Record<GamePlayerId, number> {
  const players = state.standings.map((standing) => standing.playerId);
  const gains: Record<GamePlayerId, number> = {};
  for (const playerId of players) {
    const saboteur = deal.saboteurs.includes(playerId);
    let gain = defused ? (saboteur ? 0 : DEFUSE_POINTS) : saboteur && state.votes[playerId] !== deal.safe ? SABOTAGE_POINTS : 0;
    const suspect = state.accusations[playerId];
    if (!saboteur && suspect !== undefined && deal.saboteurs.includes(suspect)) gain += CATCH_POINTS;
    if (saboteur) {
      const named = Object.values(state.accusations).filter((accused) => accused === playerId).length;
      if (named * 2 < players.length - 1) gain += ESCAPE_POINTS;
    }
    gains[playerId] = gain;
  }
  return gains;
}

function revealed(state: BombState): BombState {
  const deal = state.rounds[state.round];
  const result = state.results[state.round];
  if (deal === undefined || result === undefined) return state;
  const gains = roundGains(state, deal, result.defused);
  return {
    ...state,
    phase: 'reveal',
    results: [...state.results.slice(0, state.round), { ...result, gains }],
    standings: state.standings.map((standing) => ({ ...standing, score: standing.score + (gains[standing.playerId] ?? 0) })),
  };
}

function everyoneIn(state: BombState, acted: Readonly<Record<GamePlayerId, unknown>>, awayPlayerIds: readonly GamePlayerId[] | undefined): boolean {
  const away = new Set(awayPlayerIds ?? []);
  return state.standings.every((standing) => away.has(standing.playerId) || acted[standing.playerId] !== undefined);
}

function voted(state: BombState, event: Extract<BombEvent, { kind: 'vote' }>): BombState {
  if (state.phase !== 'debate' || event.round !== state.round) return state;
  if (event.playerId === undefined || !isPlaying(state, event.playerId)) return state;
  const next = { ...state, votes: { ...state.votes, [event.playerId]: event.wire } };
  return everyoneIn(next, next.votes, event.awayPlayerIds) ? cutWire(next) : next;
}

function gotIt(state: BombState, event: Extract<BombEvent, { kind: 'gotIt' }>): BombState {
  if (state.phase !== 'howTo' || event.playerId === undefined || !isPlaying(state, event.playerId)) return state;
  const list = state.gotIt ?? [];
  if (list.includes(event.playerId)) return state;
  const next = { ...state, gotIt: [...list, event.playerId] };
  const tapped = Object.fromEntries(next.gotIt.map((playerId) => [playerId, true]));
  return everyoneIn(next, tapped, event.awayPlayerIds) ? { ...next, phase: 'brief' } : next;
}

function accused(state: BombState, event: Extract<BombEvent, { kind: 'accuse' }>): BombState {
  if (state.phase !== 'accuse' || event.round !== state.round) return state;
  if (event.playerId === undefined || !isPlaying(state, event.playerId)) return state;
  if (event.suspect === event.playerId || !isPlaying(state, event.suspect)) return state;
  const next = { ...state, accusations: { ...state.accusations, [event.playerId]: event.suspect } };
  return everyoneIn(next, next.accusations, event.awayPlayerIds) ? revealed(next) : next;
}

function advanced(state: BombState, event: BombAdvance): BombState {
  const hostMayMove = event.fromHost === true && (event.phase === 'howTo' || event.phase === 'cut' || event.phase === 'reveal');
  if (event.playerId !== undefined && !hostMayMove) return state;
  if (event.round !== state.round || event.phase !== state.phase) return state;
  switch (state.phase) {
    case 'howTo':
      return { ...state, phase: 'brief' };
    case 'brief':
      return { ...state, phase: 'debate' };
    case 'debate':
      return cutWire(state);
    case 'cut':
      return { ...state, phase: 'accuse' };
    case 'accuse':
      return revealed(state);
    case 'reveal':
      return state.round + 1 < state.roundCount
        ? { ...state, phase: 'brief', round: state.round + 1, votes: {}, accusations: {} }
        : { ...state, phase: 'finished' };
    case 'finished':
      return state;
  }
}

function beatSeconds(state: BombState): number | undefined {
  switch (state.phase) {
    case 'howTo':
      return HOW_TO_SECONDS;
    case 'brief':
      return BRIEF_SECONDS;
    case 'debate':
      return state.debateSeconds;
    case 'cut':
      return CUT_SECONDS;
    case 'accuse':
      return ACCUSE_SECONDS;
    case 'reveal':
      return REVEAL_SECONDS;
    case 'finished':
      return undefined;
  }
}

function bombDeadline(state: BombState): GameDeadline<BombAdvance> | undefined {
  const seconds = beatSeconds(state);
  if (seconds === undefined) return undefined;
  return { beat: bombBeat(state), afterMs: seconds * 1000, event: { kind: 'advance', round: state.round, phase: state.phase } };
}

export function redactBombStateFor(state: BombState, viewer: GamePlayerId | undefined): BombState {
  const open = state.phase === 'reveal' || state.phase === 'finished';
  const votesOpen = open || state.phase === 'cut' || state.phase === 'accuse';
  const lastShown = Math.min(state.round, state.rounds.length - 1);
  const rounds = state.rounds.slice(0, lastShown + 1).map((deal, index): RoundDeal => {
    if (index < state.round || open) return deal;
    const clue = viewer === undefined ? undefined : deal.clues[viewer];
    const saboteur = viewer !== undefined && deal.saboteurs.includes(viewer);
    return {
      ...(saboteur ? { safe: deal.safe } : {}),
      saboteurs: saboteur ? deal.saboteurs : [],
      clues: clue === undefined || viewer === undefined ? {} : { [viewer]: clue },
    };
  });
  const own = <T>(record: Readonly<Record<GamePlayerId, T>>): Record<GamePlayerId, T> =>
    viewer !== undefined && record[viewer] !== undefined ? { [viewer]: record[viewer]! } : {};
  const live = state.phase === 'accuse' ? state.accusations : state.votes;
  return {
    ...state,
    rounds,
    votes: votesOpen ? state.votes : own(state.votes),
    accusations: open ? state.accusations : own(state.accusations),
    votedCount: Object.keys(live).length,
  };
}

export const bombSquadGameLogic: GameLogic<BombState, BombEvent, GameSettings> = {
  stateVersion: 2,
  decodeState: (value) => bombStateSchema.parse(value) as BombState,
  decodeEvent: (value) => bombEventSchema.parse(value) as BombEvent,
  metadata: bombSquadMetadata,
  settingsSchema: BOMB_SETTINGS_SCHEMA,
  createInitialState: ({ players, settings, seed }) => {
    const chosen = bombSettings(settings);
    const ids = players.map((player) => player.playerId);
    return {
      phase: 'howTo',
      round: 0,
      rounds: dealRounds(ids, chosen.rounds, seed ?? DEFAULT_SEED),
      roundCount: chosen.rounds,
      votes: {},
      accusations: {},
      debateSeconds: chosen.debateSeconds,
      standings: ids.map((playerId) => ({ playerId, score: 0 })),
      results: [],
    };
  },
  reduce: (state, event) => {
    switch (event.kind) {
      case 'vote':
        return voted(state, event);
      case 'accuse':
        return accused(state, event);
      case 'gotIt':
        return gotIt(state, event);
      case 'advance':
        return advanced(state, event);
    }
  },
  deadline: bombDeadline,
  redactStateFor: redactBombStateFor,
  isFinished: (state) => state.phase === 'finished',
  finishedSummary: (state) => {
    const ranked = [...state.standings].sort((a, b) => b.score - a.score);
    const defused = state.results.filter((result) => result.defused).length;
    return {
      title: `${defused} of ${state.roundCount} bombs defused`,
      standings: ranked.map((standing, index) => ({
        playerId: standing.playerId,
        score: standing.score,
        rank: ranked.findIndex((other) => other.score === standing.score) + 1 || index + 1,
      })),
    };
  },
};
