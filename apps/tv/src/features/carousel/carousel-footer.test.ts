import { describe, expect, it } from 'vitest';

import { carouselFooterLine } from './carousel-footer';
import type { RosterSeat } from '../room';

/** A seated player, as `players.roster` serves one. */
const seatOf = (nickname: string, host = false): RosterSeat => ({
  playerId: `player-${nickname}` as RosterSeat['playerId'],
  nickname,
  away: false,
  host,
  avatar: 'fox',
});

const ada = seatOf('Ada', true);

describe('carouselFooterLine', () => {
  it('reads as the board writes it while the Host browses', () => {
    expect(carouselFooterLine(ada)).toBe('Ada is browsing on their phone.');
  });

  it('says what the television is waiting for when it has no Host to name', () => {
    expect(carouselFooterLine(undefined)).toBe('Picking a game…');
  });
});
