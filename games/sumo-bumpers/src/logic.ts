import type { GameDeadline, GameLogic, GamePlayerId, GameSettings } from '@huddle/domain';

import { sumoBumpersMetadata } from './metadata';
import { sumoEventSchema, sumoStateSchema } from './schemas';
import { SUMO_SETTINGS_SCHEMA, sumoSettings } from './settings';
import { BLOB_RADIUS, clampAim, isOut, puckOwner, simulateRound } from './sim';
import type { Aim, Blob, Knockout, Point, SumoAdvance, SumoEvent, SumoPhase, SumoState } from './types';

export { BLOB_RADIUS, clampAim, isOut, PUCK_RADIUS, puckOwner, puckStart, simulateRound, stopDistance } from './sim';
export { sumoEventSchema, sumoStateSchema } from './schemas';
export type * from './types';

export const HOW_TO_SECONDS = 45;
export const REPLAY_SECONDS = 5;
export const MATCH_OVER_SECONDS = 6;
export const MAX_ROUNDS = 8;
export const SURVIVE_POINTS = 5;
export const KNOCKOUT_POINTS = 20;
export const GHOST_KNOCKOUT_POINTS = 10;
export const WIN_POINTS = 30;
const ARENA_START = 1;
const ARENA_SHRINK = 0.88;
const ARENA_MIN = 0.5;
const START_RING = 0.6;
const DEFAULT_SEED = 0x5eed;

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lineUp(ids: readonly GamePlayerId[], seed: number): Record<GamePlayerId, Blob> {
  const random = seededRandom(seed);
  const order = [...ids];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const blobs: Record<GamePlayerId, Blob> = {};
  order.forEach((id, index) => {
    const angle = (index / order.length) * Math.PI * 2 - Math.PI / 2;
    blobs[id] = { x: Math.round(Math.cos(angle) * START_RING * 1e6) / 1e6, y: Math.round(Math.sin(angle) * START_RING * 1e6) / 1e6, alive: true };
  });
  return blobs;
}

function isPlaying(state: SumoState, playerId: GamePlayerId): boolean {
  return state.standings.some((standing) => standing.playerId === playerId);
}

function alive(state: SumoState): GamePlayerId[] {
  return Object.entries(state.blobs).filter(([, blob]) => blob.alive).map(([id]) => id);
}

function resolved(state: SumoState): SumoState {
  const live = alive(state);
  const start: Record<GamePlayerId, Point> = {};
  for (const id of live) start[id] = { x: state.blobs[id]!.x, y: state.blobs[id]!.y };
  const aims: Record<GamePlayerId, Aim> = {};
  for (const [id, aim] of Object.entries(state.aims)) aims[id] = clampAim(aim);
  const run = simulateRound(start, aims, state.arenaRadius);
  const final: Record<GamePlayerId, Point> = {};
  const blobs: Record<GamePlayerId, Blob> = { ...state.blobs };
  const knockouts: Knockout[] = [];
  for (const disc of run.final) {
    if (puckOwner(disc.id) !== undefined) continue;
    final[disc.id] = { x: disc.x, y: disc.y };
    const out = isOut(disc, state.arenaRadius);
    blobs[disc.id] = { x: disc.x, y: disc.y, alive: !out };
    if (!out) continue;
    const toucher = disc.lastTouchedBy;
    const ghost = toucher === undefined ? undefined : puckOwner(toucher);
    knockouts.push(ghost !== undefined ? { out: disc.id, by: ghost, byGhost: true } : toucher !== undefined ? { out: disc.id, by: toucher, byGhost: false } : { out: disc.id, byGhost: false });
  }
  const knockedOut = knockouts.map((knockout) => knockout.out);
  const gains: Record<GamePlayerId, number> = {};
  for (const id of live) if (!knockedOut.includes(id)) gains[id] = SURVIVE_POINTS;
  for (const knockout of knockouts) {
    if (knockout.by === undefined || knockout.by === knockout.out) continue;
    gains[knockout.by] = (gains[knockout.by] ?? 0) + (knockout.byGhost ? GHOST_KNOCKOUT_POINTS : KNOCKOUT_POINTS);
  }
  return {
    ...state,
    phase: 'replay',
    blobs,
    aims: {},
    lastRound: { start, aims, final, arenaRadius: state.arenaRadius, knockedOut, knockouts },
    standings: state.standings.map((standing) => ({ ...standing, score: standing.score + (gains[standing.playerId] ?? 0) })),
  };
}

function matchWinner(state: SumoState): GamePlayerId | null | undefined {
  const live = alive(state);
  if (live.length === 1) return live[0]!;
  if (live.length === 0) return lastToFall(state);
  if (state.round + 1 < MAX_ROUNDS) return undefined;
  return [...live].sort((a, b) => {
    const da = state.blobs[a]!.x ** 2 + state.blobs[a]!.y ** 2;
    const db = state.blobs[b]!.x ** 2 + state.blobs[b]!.y ** 2;
    return da - db;
  })[0]!;
}

function lastToFall(state: SumoState): GamePlayerId | null {
  const fallen = state.lastRound?.knockedOut ?? [];
  if (fallen.length === 0) return null;
  const edge = (id: GamePlayerId) => {
    const point = state.blobs[id]!;
    return Math.sqrt(point.x * point.x + point.y * point.y) - state.arenaRadius;
  };
  return [...fallen].sort((a, b) => edge(a) - edge(b))[0]!;
}

function keptOnIce(blobs: Readonly<Record<GamePlayerId, Blob>>, arenaRadius: number): Record<GamePlayerId, Blob> {
  const limit = arenaRadius - BLOB_RADIUS * 0.6;
  const kept: Record<GamePlayerId, Blob> = {};
  for (const [id, blob] of Object.entries(blobs)) {
    const distance = Math.sqrt(blob.x * blob.x + blob.y * blob.y);
    kept[id] = !blob.alive || distance <= limit ? blob : { ...blob, x: (blob.x / distance) * limit, y: (blob.y / distance) * limit };
  }
  return kept;
}

function afterReplay(state: SumoState): SumoState {
  const winner = matchWinner(state);
  if (winner === undefined) {
    const arenaRadius = Math.max(ARENA_MIN, state.arenaRadius * ARENA_SHRINK);
    return { ...state, phase: 'aim', round: state.round + 1, arenaRadius, blobs: keptOnIce(state.blobs, arenaRadius) };
  }
  return {
    ...state,
    phase: 'matchOver',
    matchWinners: [...state.matchWinners, winner],
    standings: winner === null ? state.standings : state.standings.map((standing) => (standing.playerId === winner ? { ...standing, score: standing.score + WIN_POINTS } : standing)),
  };
}

function nextMatch(state: SumoState): SumoState {
  if (state.match + 1 >= state.matchCount) return { ...state, phase: 'finished' };
  const ids = state.standings.map((standing) => standing.playerId);
  return {
    ...state,
    phase: 'aim',
    match: state.match + 1,
    round: 0,
    arenaRadius: ARENA_START,
    blobs: lineUp(ids, DEFAULT_SEED + state.match + 1),
    aims: {},
    lastRound: undefined,
  };
}

function everyoneIn(_state: SumoState, acted: (id: GamePlayerId) => boolean, ids: readonly GamePlayerId[], away: readonly GamePlayerId[] | undefined): boolean {
  const gone = new Set(away ?? []);
  return ids.every((id) => gone.has(id) || acted(id));
}

function aimed(state: SumoState, event: Extract<SumoEvent, { kind: 'aim' }>): SumoState {
  if (state.phase !== 'aim' || event.match !== state.match || event.round !== state.round) return state;
  const id = event.playerId;
  if (id === undefined || !isPlaying(state, id) || state.blobs[id] === undefined) return state;
  const next = { ...state, aims: { ...state.aims, [id]: clampAim({ dx: event.dx, dy: event.dy }) } };
  const everyone = next.standings.map((standing) => standing.playerId);
  return everyoneIn(next, (player) => next.aims[player] !== undefined, everyone, event.awayPlayerIds) ? resolved(next) : next;
}

function gotIt(state: SumoState, event: Extract<SumoEvent, { kind: 'gotIt' }>): SumoState {
  if (state.phase !== 'howTo' || event.playerId === undefined || !isPlaying(state, event.playerId)) return state;
  const list = state.gotIt ?? [];
  if (list.includes(event.playerId)) return state;
  const next = { ...state, gotIt: [...list, event.playerId] };
  const ids = next.standings.map((standing) => standing.playerId);
  return everyoneIn(next, (player) => next.gotIt.includes(player), ids, event.awayPlayerIds) ? { ...next, phase: 'aim' } : next;
}

function advanced(state: SumoState, event: SumoAdvance): SumoState {
  const hostMayMove = event.fromHost === true && (event.phase === 'howTo' || event.phase === 'replay' || event.phase === 'matchOver');
  if (event.playerId !== undefined && !hostMayMove) return state;
  if (event.phase !== state.phase || event.match !== state.match || event.round !== state.round) return state;
  switch (state.phase) {
    case 'howTo':
      return { ...state, phase: 'aim' };
    case 'aim':
      return resolved(state);
    case 'replay':
      return afterReplay(state);
    case 'matchOver':
      return nextMatch(state);
    case 'finished':
      return state;
  }
}

function beatSeconds(state: SumoState): number | undefined {
  const seconds: Record<SumoPhase, number | undefined> = {
    howTo: HOW_TO_SECONDS,
    aim: state.aimSeconds,
    replay: REPLAY_SECONDS,
    matchOver: MATCH_OVER_SECONDS,
    finished: undefined,
  };
  return seconds[state.phase];
}

function sumoDeadline(state: SumoState): GameDeadline<SumoAdvance> | undefined {
  const seconds = beatSeconds(state);
  if (seconds === undefined) return undefined;
  return {
    beat: `${state.match}:${state.round}:${state.phase}`,
    afterMs: seconds * 1000,
    event: { kind: 'advance', match: state.match, round: state.round, phase: state.phase },
  };
}

export function redactSumoStateFor(state: SumoState, viewer: GamePlayerId | undefined): SumoState {
  const own = viewer !== undefined && state.aims[viewer] !== undefined ? { [viewer]: state.aims[viewer]! } : {};
  return { ...state, aims: own, aimedCount: Object.keys(state.aims).length };
}

export const sumoBumpersGameLogic: GameLogic<SumoState, SumoEvent, GameSettings> = {
  stateVersion: 1,
  decodeState: (value) => sumoStateSchema.parse(value) as SumoState,
  decodeEvent: (value) => sumoEventSchema.parse(value) as SumoEvent,
  metadata: sumoBumpersMetadata,
  settingsSchema: SUMO_SETTINGS_SCHEMA,
  createInitialState: ({ players, settings, seed }) => {
    const chosen = sumoSettings(settings);
    const ids = players.map((player) => player.playerId);
    return {
      phase: 'howTo',
      match: 0,
      matchCount: chosen.matches,
      round: 0,
      arenaRadius: ARENA_START,
      aimSeconds: chosen.aimSeconds,
      blobs: lineUp(ids, seed ?? DEFAULT_SEED),
      aims: {},
      matchWinners: [],
      standings: ids.map((playerId) => ({ playerId, score: 0 })),
    };
  },
  reduce: (state, event) => {
    switch (event.kind) {
      case 'aim':
        return aimed(state, event);
      case 'gotIt':
        return gotIt(state, event);
      case 'advance':
        return advanced(state, event);
    }
  },
  deadline: sumoDeadline,
  redactStateFor: redactSumoStateFor,
  isFinished: (state) => state.phase === 'finished',
  finishedSummary: (state) => {
    const ranked = [...state.standings].sort((a, b) => b.score - a.score);
    const wins = state.matchWinners.filter((winner) => winner !== null).length;
    return {
      title: `${wins} of ${state.matchCount} matches won outright`,
      standings: ranked.map((standing) => ({
        playerId: standing.playerId,
        score: standing.score,
        rank: ranked.findIndex((other) => other.score === standing.score) + 1,
      })),
    };
  },
};
