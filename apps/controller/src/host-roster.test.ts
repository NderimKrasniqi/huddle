import { describe, expect, it } from 'vitest';

import type { RosterSeat } from './host';
import { rosterFooterLine, rosterRowSlot, rosterRowSpokenAs } from './host-roster';

/** A roster the way the room serves one, as `host.test.ts` builds them. */
function seatOf({
  name,
  host = false,
  away = false,
}: {
  name: string;
  host?: boolean;
  away?: boolean;
}): RosterSeat {
  return {
    playerId: `player-${name}` as RosterSeat['playerId'],
    nickname: name,
    away,
    host,
    color: undefined,
  };
}

describe('rosterRowSlot', () => {
  it('gives the Host their pill', () => {
    expect(rosterRowSlot(seatOf({ name: 'Ada', host: true }))).toBe('host');
  });

  it('gives a player the room is hearing from the online dot', () => {
    expect(rosterRowSlot(seatOf({ name: 'Grace' }))).toBe('present');
  });

  it('says so when the room has stopped hearing from a player', () => {
    expect(rosterRowSlot(seatOf({ name: 'Milo', away: true }))).toBe('away');
  });

  it('keeps the Host pill on an away Host', () => {
    // The pill wins, and it costs nothing: this roster is drawn on the Host's
    // own phone, so the row marked `host` is the reader's, and a phone with
    // this screen in front of its owner is beating. See `rosterRowSlot`.
    expect(rosterRowSlot(seatOf({ name: 'Ada', host: true, away: true }))).toBe('host');
  });
});

describe('rosterRowSpokenAs', () => {
  it('speaks the away state a muted dot says in colour alone', () => {
    expect(rosterRowSpokenAs(seatOf({ name: 'Milo', away: true }))).toBe('Milo, away');
  });

  it('speaks a present player', () => {
    expect(rosterRowSpokenAs(seatOf({ name: 'Grace' }))).toBe('Grace, online');
  });

  it('speaks the Host', () => {
    expect(rosterRowSpokenAs(seatOf({ name: 'Ada', host: true }))).toBe('Ada, host');
  });
});

describe('rosterFooterLine', () => {
  it('says the party can start whenever it can', () => {
    expect(rosterFooterLine(3, true)).toBe('3 players in — you can start anytime');
  });

  it('drops the invitation when the room is too small to start', () => {
    // The start control under it says what the room is short of; two lines
    // disagreeing about whether a game can begin is worse than one saying less.
    expect(rosterFooterLine(1, false)).toBe('1 player in');
  });

  it('counts one player as one player', () => {
    expect(rosterFooterLine(1, true)).toBe('1 player in — you can start anytime');
  });

  it('pluralises an empty room', () => {
    // Not a screen anybody sees — `HostRoster` is drawn for a Host, and
    // `lobbyStanding` finds none on an empty roster. Pinned because the rule is
    // arithmetic on a count and has to be total over the counts it can be
    // handed, not because zero is reachable.
    expect(rosterFooterLine(0, false)).toBe('0 players in');
  });
});
