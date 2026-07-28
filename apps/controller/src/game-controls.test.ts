import type { RosterSeatForGame } from '@huddle/game-core';
import { GAME_REGISTRY } from '@huddle/game-registry';
import { describe, expect, it } from 'vitest';

import { gameToStart, startControl } from './game-controls';

function party(size: number): RosterSeatForGame[] {
  return Array.from({ length: size }, (_unused, index) => ({
    playerId: `p${index}`,
    nickname: `Player ${index}`,
    away: false,
    host: index === 0,
  }));
}

describe('the game the Host would start', () => {
  it('is the one the Registry installs', () => {
    // Not "trivia": the phone reads the Registry, and naming a game here is the
    // thing the whole interface exists to avoid.
    expect(gameToStart()).toBe(GAME_REGISTRY[0]?.metadata);
  });
});

describe('the Host’s start control', () => {
  it('offers the installed game by name', () => {
    const control = startControl(party(2));

    expect(control.label).toBe(`Start ${GAME_REGISTRY[0]?.metadata.title}`);
    expect(control.enabled).toBe(true);
    expect(control.blockedBecause).toBeUndefined();
  });

  it('waits, and says what it is waiting for, one player short', () => {
    const control = startControl(party(1));

    expect(control.enabled).toBe(false);
    // Singular, because "needs 1 more players" is what a machine says.
    expect(control.blockedBecause).toBe(`${GAME_REGISTRY[0]?.metadata.title} needs one more player.`);
  });

  it('counts how many more are needed when it is more than one', () => {
    // No installed game needs three today; the wording is what is being pinned,
    // and it has to be right the first time a game does.
    const control = startControl([]);
    const need = GAME_REGISTRY[0]?.metadata.playerRange.min ?? 0;

    expect(control.enabled).toBe(false);
    expect(control.blockedBecause).toBe(
      `${GAME_REGISTRY[0]?.metadata.title} needs ${need} more players.`,
    );
  });

  it('still names the game it is waiting to start', () => {
    // The label does not become "Waiting…": the Host should see what the button
    // will do once the room fills, not lose it while the room is short.
    expect(startControl(party(1)).label).toBe(`Start ${GAME_REGISTRY[0]?.metadata.title}`);
  });

  it('counts an away player, since the room still seats them', () => {
    const withOneAway: RosterSeatForGame[] = [
      { playerId: 'p0', nickname: 'Ada', away: false, host: true },
      { playerId: 'p1', nickname: 'Grace', away: true, host: false },
    ];

    // The same count `startGame` uses — excluding away players is Phase 4's
    // "Away players in-game", and the two must not disagree before then.
    expect(startControl(withOneAway).enabled).toBe(true);
  });
});
