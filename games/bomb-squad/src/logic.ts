import type { GameDeadline, GameLogic, GamePlayerId, GameSettings } from '@huddle/domain';

import { dealRounds } from './clues';
import { bombSquadMetadata } from './metadata';
import { bombEventSchema, bombStateSchema } from './schemas';
import { BOMB_SETTINGS_SCHEMA, bombSettings } from './settings';
import type { BombAdvance, BombEvent, BombState, RoundDeal, RoundResult, Wire } from './types';

export { clueHolds, dealRound, dealRounds, saboteurCount } from './clues';
export { bombEventSchema, bombStateSchema } from './schemas';
export type * from './types';

/** The rules, once, before the first bomb; the host can start sooner. */
export const HOW_TO_SECONDS = 25;
/** Long enough to read your clue twice. */
export const BRIEF_SECONDS = 10;
export const REVEAL_SECONDS = 10;
export const DEFUSE_POINTS = 100;
export const SABOTAGE_POINTS = 150;

/** Without a server seed (tests, legacy callers) the game still deals, just the same way each time. */
const DEFAULT_SEED = 0x5eed;

export function bombBeat(state: BombState): string {
  return `${state.round}:${state.phase}`;
}

/** Whether the player is in this game; anyone who joined mid-game is watching. */
function isPlaying(state: BombState, playerId: GamePlayerId): boolean {
  return state.standings.some((standing) => standing.playerId === playerId);
}

/**
 * The wire the room cut: the one with the most votes. A tie, or no votes at
 * all, means nobody agreed in time, and the bomb goes off.
 */
export function wireCut(votes: Readonly<Record<GamePlayerId, Wire>>): Wire | null {
  const tally = new Map<Wire, number>();
  for (const wire of Object.values(votes)) tally.set(wire, (tally.get(wire) ?? 0) + 1);
  let best: Wire | null = null;
  let bestCount = 0;
  let tied = false;
  for (const [wire, count] of tally) {
    if (count > bestCount) {
      best = wire;
      bestCount = count;
      tied = false;
    } else if (count === bestCount) {
      tied = true;
    }
  }
  return tied ? null : best;
}

/**
 * Points for a round. A defused bomb pays every honest player; an explosion
 * pays every saboteur, except one who voted for the safe wire, so a saboteur
 * cannot win by quietly agreeing with the room.
 */
export function roundResult(deal: RoundDeal, votes: Readonly<Record<GamePlayerId, Wire>>, players: readonly GamePlayerId[]): RoundResult {
  const cut = wireCut(votes);
  const defused = cut !== null && cut === deal.safe;
  const gains: Record<GamePlayerId, number> = {};
  for (const playerId of players) {
    const saboteur = deal.saboteurs.includes(playerId);
    if (defused) gains[playerId] = saboteur ? 0 : DEFUSE_POINTS;
    else gains[playerId] = saboteur && votes[playerId] !== deal.safe ? SABOTAGE_POINTS : 0;
  }
  return { cut, defused, gains };
}

function revealed(state: BombState): BombState {
  const deal = state.rounds[state.round];
  if (deal === undefined) return state;
  const players = state.standings.map((standing) => standing.playerId);
  const result = roundResult(deal, state.votes, players);
  return {
    ...state,
    phase: 'reveal',
    results: [...state.results, result],
    standings: state.standings.map((standing) => ({ ...standing, score: standing.score + (result.gains[standing.playerId] ?? 0) })),
  };
}

function voted(state: BombState, event: Extract<BombEvent, { kind: 'vote' }>): BombState {
  if (state.phase !== 'debate' || event.round !== state.round) return state;
  if (event.playerId === undefined || !isPlaying(state, event.playerId)) return state;
  const votes = { ...state.votes, [event.playerId]: event.wire };
  const next = { ...state, votes };
  // Once every player still here has voted, nobody is left to wait for.
  const away = new Set(event.awayPlayerIds ?? []);
  const waiting = state.standings.some((standing) => !away.has(standing.playerId) && votes[standing.playerId] === undefined);
  return waiting ? next : revealed(next);
}

function advanced(state: BombState, event: BombAdvance): BombState {
  // Only the room's clock moves a beat, except the Host may skip the rules or a reveal.
  const hostMayMove = event.fromHost === true && (event.phase === 'reveal' || event.phase === 'howTo');
  if (event.playerId !== undefined && !hostMayMove) return state;
  if (event.round !== state.round || event.phase !== state.phase) return state;
  switch (state.phase) {
    case 'howTo':
      return { ...state, phase: 'brief' };
    case 'brief':
      return { ...state, phase: 'debate' };
    case 'debate':
      return revealed(state);
    case 'reveal':
      return state.round + 1 < state.roundCount
        ? { ...state, phase: 'brief', round: state.round + 1, votes: {} }
        : { ...state, phase: 'finished' };
    case 'finished':
      return state;
  }
}

/** Seconds each beat runs before the room moves on by itself. */
export function beatSeconds(state: BombState): number | undefined {
  switch (state.phase) {
    case 'howTo':
      return HOW_TO_SECONDS;
    case 'brief':
      return BRIEF_SECONDS;
    case 'debate':
      return state.debateSeconds;
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

/**
 * What one viewer may see. Rounds still to come are dropped for everyone. In
 * the current round a player sees only their own clue, plus, if they are a
 * saboteur, the safe wire and their partners; the TV sees no secret at all.
 * Votes stay private until the reveal. Revealed rounds are public, so the
 * reveal can say who lied.
 */
export function redactBombStateFor(state: BombState, viewer: GamePlayerId | undefined): BombState {
  const open = state.phase === 'reveal' || state.phase === 'finished';
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
  const votes = open
    ? state.votes
    : viewer !== undefined && state.votes[viewer] !== undefined
      ? { [viewer]: state.votes[viewer]! }
      : {};
  return { ...state, rounds, votes, votedCount: Object.keys(state.votes).length };
}

export const bombSquadGameLogic: GameLogic<BombState, BombEvent, GameSettings> = {
  stateVersion: 1,
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
      debateSeconds: chosen.debateSeconds,
      standings: ids.map((playerId) => ({ playerId, score: 0 })),
      results: [],
    };
  },
  reduce: (state, event) => {
    switch (event.kind) {
      case 'vote':
        return voted(state, event);
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
