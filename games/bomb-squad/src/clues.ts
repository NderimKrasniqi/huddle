import type { GamePlayerId } from '@huddle/domain';

import { type Clue, type RoundDeal, type Wire, WIRES } from './types';

const WARM: readonly Wire[] = ['red', 'yellow'];

/** How many different true clues one round hands out. */
const DISTINCT_TRUTHS = 2;
const LEFT: readonly Wire[] = ['red', 'blue'];

/**
 * Every clue the game can give. "Next to" names only the two middle wires:
 * each has two neighbours, so the clue narrows the answer to two wires. "Next
 * to red" would name blue outright and end the round on one phone.
 */
const ALL_CLUES: readonly Clue[] = [
  ...WIRES.map((wire) => ({ kind: 'not', wire }) as const),
  { kind: 'tone', tone: 'warm' },
  { kind: 'tone', tone: 'cool' },
  { kind: 'side', side: 'left' },
  { kind: 'side', side: 'right' },
  { kind: 'nextTo', wire: 'blue' },
  { kind: 'nextTo', wire: 'yellow' },
];

/** Whether `clue` is true when `safe` is the safe wire. */
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

/** How many saboteurs a room of this size gets. */
export function saboteurCount(players: number): number {
  return players >= 7 ? 2 : players >= 3 ? 1 : 0;
}

/** A small seeded generator: the rules may not call Math.random. */
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

/**
 * One round: a safe wire, who lies, and a clue for everyone. Honest players get
 * true clues, spread so two honest players rarely hold the same one; saboteurs
 * get false clues that sound just as sure.
 */
export function dealRound(players: readonly GamePlayerId[], random: () => number): RoundDeal {
  const safe = WIRES[Math.floor(random() * WIRES.length)] ?? 'red';
  const order = shuffled(players, random);
  const saboteurs = order.slice(0, saboteurCount(players.length));
  // Two different truths a round, whatever the room size: a big room repeats
  // them rather than adding more, so honest players still have to trust each
  // other and a saboteur's lie can still tip the vote.
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

/** Every round of a game, dealt once at the start from the server's seed. */
export function dealRounds(players: readonly GamePlayerId[], rounds: number, seed: number): RoundDeal[] {
  const random = seededRandom(seed);
  return Array.from({ length: rounds }, () => dealRound(players, random));
}
