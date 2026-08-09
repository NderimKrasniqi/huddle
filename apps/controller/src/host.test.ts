import { describe, expect, it } from 'vitest';

import { lobbyStanding, type RosterSeat } from './host';

/**
 * A roster the way the room serves one. The ids are the room's, so they are
 * written here as the opaque strings they are on the wire — nothing on the
 * phone reads anything out of one.
 */
function seatsOf(...seats: readonly { name: string; host?: boolean }[]): RosterSeat[] {
  return seats.map(({ name, host = false }) => ({
    playerId: `player-${name}` as RosterSeat['playerId'],
    nickname: name,
    away: false,
    host,
    avatar: 'fox' as const,
  }));
}

/** The id the room knows a player by, as `seatsOf` mints them. */
function idOf(name: string): RosterSeat['playerId'] {
  return `player-${name}` as RosterSeat['playerId'];
}

describe('lobbyStanding', () => {
  it('tells the host that they are the host', () => {
    const roster = seatsOf({ name: 'Ada', host: true }, { name: 'Grace' });

    expect(lobbyStanding(roster, idOf('Ada'))).toEqual({
      youAreHost: true,
      hostNickname: 'Ada',
      hostAvatar: 'fox',
    });
  });

  it('tells everybody else who is', () => {
    const roster = seatsOf({ name: 'Ada', host: true }, { name: 'Grace' });

    expect(lobbyStanding(roster, idOf('Grace'))).toEqual({
      youAreHost: false,
      hostNickname: 'Ada',
      hostAvatar: 'fox',
    });
  });

  it('follows the host when the room hands it on', () => {
    // The same phone, the same screen, and a room that has given up on Ada
    // while Grace was holding it. Nothing relaunched: this is the next value of
    // the subscription the screen already had open.
    const before = seatsOf({ name: 'Ada', host: true }, { name: 'Grace' });
    const after = seatsOf({ name: 'Ada' }, { name: 'Grace', host: true });

    expect(lobbyStanding(before, idOf('Grace')).youAreHost).toBe(false);
    expect(lobbyStanding(after, idOf('Grace')).youAreHost).toBe(true);
    // And the phone that was the host stops saying so, which is the half of a
    // handover a player can actually see.
    expect(lobbyStanding(after, idOf('Ada'))).toEqual({
      youAreHost: false,
      hostNickname: 'Grace',
      hostAvatar: 'fox',
    });
  });

  it('names nobody while the roster has yet to arrive', () => {
    expect(lobbyStanding([], idOf('Ada'))).toEqual({
      youAreHost: false,
      hostNickname: undefined,
      hostAvatar: undefined,
    });
  });
});
