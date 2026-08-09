import { describe, expect, it } from 'vitest';

import { type Arrivals, isArrival, isGreeting, JUST_JOINED_MS, noteArrivals } from './just-joined';

/**
 * A roster row, as much of one as this module reads. The real type is each
 * app's own name for a `players.roster` row; the module is generic over the id
 * precisely so it does not need either, and neither does this.
 */
type Seat = { readonly playerId: string; readonly nickname: string; readonly avatar: string };

/**
 * A roster the way `players.roster` serves one. The ids are the room's, written
 * here as the opaque strings they are on the wire — a screen reads nothing out
 * of one but the seat it belongs to.
 */
function seatsOf(...names: readonly string[]): Seat[] {
  return names.map((nickname) => ({
    playerId: idOf(nickname),
    nickname,
    avatar: 'fox',
  }));
}

/** The id the room knows a player by, as `seatsOf` mints them. */
function idOf(nickname: string): string {
  return `player-${nickname}`;
}

describe('JUST_JOINED_MS', () => {
  it('is the handoff’s four seconds', () => {
    // "holds the JUST JOINED! treatment for ~4s before settling to the normal
    // style" — the Avatar pop-in, carried into Soft Minimal, where the chip is
    // the system's one informational blue rather than Soft Minimal's pink.
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
    // Going away and a heartbeat both push a fresh roster, and this is folded
    // during render: an unchanged answer that were a *new* object would set
    // state on every render and never settle.
    const seen = noteArrivals(noteArrivals(undefined, []), seatsOf('Ada'));
    const restated = seatsOf('Ada').map((seat) => ({
      ...seat,
      avatar: 'fox' as const,
      away: true,
    }));

    expect(noteArrivals(seen, restated)).toBe(seen);
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

describe('isGreeting', () => {
  /** Nobody greeted yet — a television that has just put the Room up. */
  const nobody = new Set<string>();

  /** What this screen has watched, having found `found` seated and then been pushed `pushed`. */
  const watched = (found: readonly Seat[], ...pushed: readonly Seat[][]): Arrivals<string> =>
    pushed.reduce<Arrivals<string>>(
      (seen, roster) => noteArrivals(seen, roster),
      noteArrivals(undefined, found),
    );

  it('greets an arrival the screen has not spent its four seconds on', () => {
    const seen = watched([], seatsOf('Ada'));

    expect(isGreeting(seen, nobody, idOf('Ada'))).toBe(true);
  });

  it('does not greet the same arrival twice', () => {
    // The bug this exists for: being an Arrival is permanent, so without this
    // the seat wears its chip forever.
    const seen = watched([], seatsOf('Ada'));

    expect(isGreeting(seen, new Set([idOf('Ada')]), idOf('Ada'))).toBe(false);
  });

  it('does not re-greet a spent arrival when a game ends and the Room comes back', () => {
    // The grid is unmounted for the length of a game and mounted again when it
    // ends. Ada joined before the game; nobody joined during it, so the
    // television has nothing to announce on its way back.
    const seen = watched([], seatsOf('Ada'));

    expect(isGreeting(seen, new Set([idOf('Ada')]), idOf('Ada'))).toBe(false);
  });

  it('greets two phones that land together, each on their own seat', () => {
    // What the carousel's single footer line could not do: it had one slot, so
    // the newer arrival took the older one's sentence.
    const seen = watched([], seatsOf('Ada'), seatsOf('Ada', 'Grace'));

    expect(isGreeting(seen, nobody, idOf('Ada'))).toBe(true);
    expect(isGreeting(seen, nobody, idOf('Grace'))).toBe(true);
  });

  it('greets nobody the screen merely found sitting there', () => {
    const seen = watched(seatsOf('Ada', 'Grace'));

    expect(isGreeting(seen, nobody, idOf('Ada'))).toBe(false);
  });

  it('greets nobody before the first roster has landed', () => {
    expect(isGreeting(undefined, nobody, idOf('Ada'))).toBe(false);
  });
});
