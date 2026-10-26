import type { GamePlayerId } from '@huddle/domain';

import { type Clue, type RoundDeal, type Wire, WIRES } from './types';

const WARM: readonly Wire[] = ['red', 'yellow'];

const DISTINCT_TRUTHS = 2;
const LEFT: readonly Wire[] = ['red', 'blue'];

const ALL_CLUES: readonly Clue[] = [
  ...WIRES.map((wire) => ({ kind: 'not', wire }) as const),
  { kind: 'tone', tone: 'warm' },
  { kind: 'tone', tone: 'cool' },
  { kind: 'side', side: 'left' },
  { kind: 'side', side: 'right' },
  { kind: 'nextTo', wire: 'blue' },
  { kind: 'nextTo', wire: 'yellow' },
];

export function clueHolds(clue: Clue, safe: Wire): boolean {
  switch (clue.kind) {
    case 'not':
      return safe !== clue.wire;
    case 'tone':
      return WARM.includes(safe) === (clue.tone === 'warm');
    case 'side':
      return LEFT.includes(safe) === (clue.side === 'left');
    case 'nextTo':
      return Math.abs(WIRES.indexOf(safe) - WIRES.indexOf(clue.wire)) === 1;
  }
}

export function saboteurCount(players: number): number {
  return players >= 7 ? 2 : players >= 3 ? 1 : 0;
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export function dealRound(players: readonly GamePlayerId[], random: () => number): RoundDeal {
  const safe = WIRES[Math.floor(random() * WIRES.length)] ?? 'red';
  const order = shuffled(players, random);
  const saboteurs = order.slice(0, saboteurCount(players.length));
  const truths = shuffled(ALL_CLUES.filter((clue) => clueHolds(clue, safe)), random).slice(0, DISTINCT_TRUTHS);
  const lies = shuffled(ALL_CLUES.filter((clue) => !clueHolds(clue, safe)), random);
  const clues: Record<GamePlayerId, Clue> = {};
  let told = 0;
  let lied = 0;
  for (const playerId of players) {
    if (saboteurs.includes(playerId)) {
      clues[playerId] = lies[lied % lies.length]!;
      lied += 1;
    } else {
      clues[playerId] = truths[told % truths.length]!;
      told += 1;
    }
  }
  return { safe, saboteurs, clues, tieOrder: shuffled(WIRES, random) };
}

export function dealRounds(players: readonly GamePlayerId[], rounds: number, seed: number): RoundDeal[] {
  const random = seededRandom(seed);
  return Array.from({ length: rounds }, () => dealRound(players, random));
}
