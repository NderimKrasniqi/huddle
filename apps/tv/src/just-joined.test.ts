import { describe, expect, it } from 'vitest';

import { isArrival, JUST_JOINED_MS, noteArrivals } from './just-joined';
import type { RosterSeat } from './roster';

/**
 * A roster the way `players.roster` serves one. The ids are the room's, written
 * here as the opaque strings they are on the wire — the TV reads nothing out of
 * one but the seat it belongs to.
 */
function seatsOf(...names: readonly string[]): RosterSeat[] {
  return names.map((nickname) => ({
    playerId: idOf(nickname),
    nickname,
    away: false,
    host: false,
    avatar: 'fox',
  }));
}

/** The id the room knows a player by, as `seatsOf` mints them. */
function idOf(nickname: string): RosterSeat['playerId'] {
  return `player-${nickname}` as RosterSeat['playerId'];
}

describe('JUST_JOINED_MS', () => {
  it('is the handoff’s four seconds', () => {
    // "holds the pink JUST JOINED! treatment for ~4s before settling to the
    // normal style" — docs/design/design-handoff.md, Avatar pop-in.
    expect(JUST_JOINED_MS).toBe(4_000);
  });
});

describe('noteArrivals', () => {
  it('greets a seat that is taken while the screen is watching', () => {
    const empty = noteArrivals(undefined, []);
    const seen = noteArrivals(empty, seatsOf('Ada'));

    expect(isArrival(seen, idOf('Ada'))).toBe(true);
  });

  it('greets nobody it finds already seated', () => {
    // A relaunched app has not just watched a room fill up, and a screen that
    // flashed everybody pink on mount would be saying something untrue about
    // every one of them.
    const seen = noteArrivals(undefined, seatsOf('Ada', 'Grace'));

    expect(isArrival(seen, idOf('Ada'))).toBe(false);
    expect(isArrival(seen, idOf('Grace'))).toBe(false);
  });

  it('greets each arrival without disturbing the last', () => {
    const empty = noteArrivals(undefined, []);
    const withAda = noteArrivals(empty, seatsOf('Ada'));
    const withGrace = noteArrivals(withAda, seatsOf('Ada', 'Grace'));

    // Ada's own four seconds are hers to run out; a second phone landing
    // mid-count must not end them, and must not restart them either.
    expect(isArrival(withGrace, idOf('Ada'))).toBe(true);
    expect(isArrival(withGrace, idOf('Grace'))).toBe(true);
  });

  it('hands back the same answer when a snapshot seats nobody', () => {
    // Claiming a color and going away both push a fresh roster, and this is
    // folded during render: an unchanged answer that were a *new* object would
    // set state on every render and never settle.
    const seen = noteArrivals(noteArrivals(undefined, []), seatsOf('Ada'));
    const recolored = seatsOf('Ada').map((seat) => ({
      ...seat,
      avatar: 'fox' as const,
      away: true,
    }));

    expect(noteArrivals(seen, recolored)).toBe(seen);
    expect(noteArrivals(seen, seatsOf('Ada'))).toBe(seen);
  });

  it('forgets a player whose seat is gone, and greets them again if it comes back', () => {
    const seen = noteArrivals(noteArrivals(undefined, []), seatsOf('Ada'));
    const emptied = noteArrivals(seen, []);

    expect(isArrival(emptied, idOf('Ada'))).toBe(false);
    expect(isArrival(noteArrivals(emptied, seatsOf('Ada')), idOf('Ada'))).toBe(true);
  });

  it('says nothing about a player who is not in the room', () => {
    const seen = noteArrivals(undefined, seatsOf('Ada'));

    expect(isArrival(seen, idOf('Grace'))).toBe(false);
  });

  it('keeps greeting nobody while the room stays empty', () => {
    const empty = noteArrivals(undefined, []);

    expect(noteArrivals(empty, [])).toBe(empty);
  });
});
