import type { GamePlayer } from '@huddle/domain';
import { describe, expect, it } from 'vitest';

import { ALL_CLUES, clueHolds, dealRounds, saboteurCount } from './clues';
import { bombSquadGameLogic as logic, DEFUSE_POINTS, redactBombStateFor, SABOTAGE_POINTS, wireCut } from './logic';
import type { BombState, Wire } from './types';
import { WIRES } from './types';

const players = (count: number): GamePlayer[] =>
  Array.from({ length: count }, (_, index) => ({ playerId: `p${index}`, nickname: `P${index}`, away: false, avatar: 'fox' }));

function start(count: number, seed = 7): BombState {
  return logic.createInitialState({ players: players(count), settings: {}, seed });
}

function toDebate(state: BombState): BombState {
  return logic.reduce(state, { kind: 'advance', round: state.round, phase: 'brief' });
}

describe('clues', () => {
  it('deals honest players true clues and saboteurs false ones', () => {
    for (let seed = 1; seed < 200; seed += 1) {
      for (const deal of dealRounds(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 3, seed)) {
        expect(deal.saboteurs).toHaveLength(2);
        for (const [playerId, clue] of Object.entries(deal.clues)) {
          expect(clueHolds(clue, deal.safe!)).toBe(!deal.saboteurs.includes(playerId));
        }
      }
    }
  });

  it('never gives a clue that names the safe wire on its own', () => {
    for (const clue of ALL_CLUES) {
      expect(WIRES.filter((wire) => clueHolds(clue, wire)).length).toBeGreaterThan(1);
    }
  });

  it('scales saboteurs with the room', () => {
    expect([3, 6, 7, 10].map(saboteurCount)).toEqual([1, 1, 2, 2]);
  });

  it('leaves the honest clues alone short of proof in a real share of rounds', () => {
    // If honest clues always pinned the wire, saboteurs could never win.
    let pinned = 0;
    let total = 0;
    for (let seed = 1; seed <= 500; seed += 1) {
      const [deal] = dealRounds(['a', 'b', 'c', 'd', 'e'], 1, seed);
      const honest = Object.entries(deal!.clues).filter(([id]) => !deal!.saboteurs.includes(id)).map(([, clue]) => clue);
      const fits = WIRES.filter((wire) => honest.every((clue) => clueHolds(clue, wire)));
      if (fits.length === 1) pinned += 1;
      total += 1;
    }
    expect(pinned / total).toBeGreaterThan(0.2);
    expect(pinned / total).toBeLessThan(0.95);
  });
});

describe('a round', () => {
  it('cuts the most-voted wire and calls a tie a blast', () => {
    expect(wireCut({ a: 'red', b: 'red', c: 'blue' })).toBe('red');
    expect(wireCut({ a: 'red', b: 'blue' })).toBeNull();
    expect(wireCut({})).toBeNull();
  });

  it('pays the honest players when the safe wire is cut', () => {
    let state = toDebate(start(4));
    const safe = state.rounds[0]!.safe as Wire;
    for (const { playerId } of state.standings) state = logic.reduce(state, { kind: 'vote', playerId, round: 0, wire: safe });
    expect(state.phase).toBe('reveal');
    const saboteur = state.rounds[0]!.saboteurs[0]!;
    for (const { playerId, score } of state.standings) expect(score).toBe(playerId === saboteur ? 0 : DEFUSE_POINTS);
  });

  it('pays saboteurs on a blast, but not one who voted for the safe wire', () => {
    let state = toDebate(start(7));
    const deal = state.rounds[0]!;
    const wrong = WIRES.find((wire) => wire !== deal.safe)!;
    const [traitor, quiet] = deal.saboteurs;
    for (const { playerId } of state.standings) {
      state = logic.reduce(state, { kind: 'vote', playerId, round: 0, wire: playerId === quiet ? deal.safe! : wrong });
    }
    const score = (id: string) => state.standings.find((standing) => standing.playerId === id)!.score;
    expect(score(traitor!)).toBe(SABOTAGE_POINTS);
    expect(score(quiet!)).toBe(0);
  });

  it('ignores votes outside the debate and from people not playing', () => {
    const brief = start(4);
    expect(logic.reduce(brief, { kind: 'vote', playerId: 'p0', round: 0, wire: 'red' })).toBe(brief);
    const debate = toDebate(brief);
    expect(logic.reduce(debate, { kind: 'vote', playerId: 'late', round: 0, wire: 'red' })).toBe(debate);
  });

  it('lets only the clock move a beat, except the host skipping a reveal', () => {
    const state = start(4);
    expect(logic.reduce(state, { kind: 'advance', playerId: 'p0', round: 0, phase: 'brief' })).toBe(state);
  });

  it('runs every round and then finishes', () => {
    let state = start(3);
    for (let round = 0; round < state.roundCount; round += 1) {
      state = logic.reduce(state, { kind: 'advance', round, phase: 'brief' });
      state = logic.reduce(state, { kind: 'advance', round, phase: 'debate' });
      state = logic.reduce(state, { kind: 'advance', round, phase: 'reveal' });
    }
    expect(state.phase).toBe('finished');
    expect(state.results).toHaveLength(5);
    expect(logic.isFinished?.(state)).toBe(true);
  });
});

describe('privacy', () => {
  const state = toDebate(start(7, 42));
  const deal = state.rounds[0]!;
  const honest = state.standings.map((s) => s.playerId).find((id) => !deal.saboteurs.includes(id))!;
  const saboteur = deal.saboteurs[0]!;

  it('never sends future rounds to anyone', () => {
    for (const viewer of [undefined, honest, saboteur]) {
      expect(redactBombStateFor(state, viewer).rounds).toHaveLength(1);
    }
  });

  it('shows the TV no clue, role or safe wire during a round', () => {
    const tv = redactBombStateFor(state, undefined).rounds[0]!;
    expect(tv).toEqual({ saboteurs: [], clues: {} });
  });

  it('shows an honest player only their own clue', () => {
    const own = redactBombStateFor(state, honest).rounds[0]!;
    expect(own.safe).toBeUndefined();
    expect(own.saboteurs).toEqual([]);
    expect(Object.keys(own.clues)).toEqual([honest]);
  });

  it('tells a saboteur the safe wire and their partners, and nobody else\'s clue', () => {
    const own = redactBombStateFor(state, saboteur).rounds[0]!;
    expect(own.safe).toBe(deal.safe);
    expect(own.saboteurs).toEqual(deal.saboteurs);
    expect(Object.keys(own.clues)).toEqual([saboteur]);
  });

  it('keeps votes private until the reveal but shares the count', () => {
    const after = logic.reduce(state, { kind: 'vote', playerId: honest, round: 0, wire: 'red' });
    expect(redactBombStateFor(after, saboteur).votes).toEqual({});
    expect(redactBombStateFor(after, honest).votes).toEqual({ [honest]: 'red' });
    expect(redactBombStateFor(after, undefined).votedCount).toBe(1);
  });

  it('opens the round at the reveal', () => {
    const shown = logic.reduce(state, { kind: 'advance', round: 0, phase: 'debate' });
    expect(redactBombStateFor(shown, undefined).rounds[0]).toEqual(deal);
  });

  it('round-trips a redacted state through the decoder', () => {
    for (const viewer of [undefined, honest, saboteur]) {
      expect(() => logic.decodeState(redactBombStateFor(state, viewer))).not.toThrow();
    }
  });
});
