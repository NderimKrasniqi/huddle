import { describe, expect, it } from 'vitest';

import { arrivalToGreet, carouselFooterLine, newestArrival } from './carousel-footer';
import { type Arrivals, noteArrivals } from './just-joined';
import type { RosterSeat } from './roster';

/** A seated player, as `players.roster` serves one. */
const seatOf = (nickname: string, host = false): RosterSeat => ({
  playerId: `player-${nickname}` as RosterSeat['playerId'],
  nickname,
  away: false,
  host,
  avatar: 'fox',
});

const ada = seatOf('Ada', true);
const grace = seatOf('Grace');
const alan = seatOf('Alan');

/** What this screen has watched, having found `found` seated and then been pushed `pushed`. */
const watched = (found: readonly RosterSeat[], ...pushed: readonly RosterSeat[][]): Arrivals =>
  pushed.reduce<Arrivals>(
    (seen, roster) => noteArrivals(seen, roster),
    noteArrivals(undefined, found),
  );

describe('newestArrival', () => {
  it('greets nobody before the first roster has landed', () => {
    // Seated players and no snapshot yet: everyone on the first roster was
    // found there, so the guard has to answer before the search does.
    expect(newestArrival(undefined, [ada, grace])).toBeUndefined();
  });

  it('greets nobody the screen merely found sitting there', () => {
    // A relaunched television has not just watched three people walk in.
    expect(newestArrival(watched([ada, grace, alan]), [ada, grace, alan])).toBeUndefined();
  });

  it('greets the player the screen watched arrive', () => {
    expect(newestArrival(watched([ada], [ada, grace]), [ada, grace])).toEqual(grace);
  });

  it('greets the newest of them when several have arrived', () => {
    // The roster is served in join order, so the last arrival on it is the
    // one whose phone has only just landed.
    const seen = watched([ada], [ada, grace], [ada, grace, alan]);

    expect(newestArrival(seen, [ada, grace, alan])).toEqual(alan);
  });

  it('greets an arrival rather than whoever happens to sit last', () => {
    // Join order puts an arrival at the end, so this ordering is synthetic —
    // it is here to pin that the line is chosen by what the screen watched and
    // not by the roster's last row.
    const seen = watched([ada], [ada, grace]);

    expect(newestArrival(seen, [grace, ada])).toEqual(grace);
  });
});

describe('arrivalToGreet', () => {
  /** Nobody greeted yet — a television that has just opened the carousel. */
  const nobody = new Set<RosterSeat['playerId']>();

  it('greets an arrival the screen has not spent its four seconds on', () => {
    expect(arrivalToGreet(watched([ada], [ada, grace]), [ada, grace], nobody)).toEqual(grace);
  });

  it('does not greet the same arrival twice', () => {
    // The bug this exists for: being an Arrival is permanent, so without this
    // the line announces the room's newest player forever.
    const seen = watched([ada], [ada, grace]);

    expect(arrivalToGreet(seen, [ada, grace], new Set([grace.playerId]))).toBeUndefined();
  });

  it('does not re-greet a spent arrival when a game ends and the carousel comes back', () => {
    // The carousel is unmounted for the length of a game and mounted again
    // when it ends. Grace joined before the game; nobody joined during it, so
    // the television has nothing to announce on its way back.
    const seen = watched([ada], [ada, grace]);
    const spent = new Set([grace.playerId]);

    expect(arrivalToGreet(seen, [ada, grace], spent)).toBeUndefined();
  });

  it('still greets a phone that lands while an earlier arrival is spent', () => {
    // A game ending must not swallow the next real arrival.
    const seen = watched([ada], [ada, grace], [ada, grace, alan]);

    expect(arrivalToGreet(seen, [ada, grace, alan], new Set([grace.playerId]))).toEqual(alan);
  });

  it('greets nobody before the first roster has landed', () => {
    expect(arrivalToGreet(undefined, [ada], nobody)).toBeUndefined();
  });
});

describe('carouselFooterLine', () => {
  it('reads as the handoff writes it while the Host browses', () => {
    expect(carouselFooterLine(ada, undefined)).toEqual({
      text: 'Ada is browsing on their phone',
      greeting: false,
    });
  });

  it('says what the television is waiting for when it has no Host to name', () => {
    expect(carouselFooterLine(undefined, undefined)).toEqual({
      text: 'Picking a game…',
      greeting: false,
    });
  });

  it('hands the line to an arrival for their four seconds', () => {
    expect(carouselFooterLine(ada, grace)).toEqual({
      text: 'Grace just joined!',
      greeting: true,
    });
  });

  it('greets the Host’s own arrival, since the room’s first player is both', () => {
    // The precedence the pairing seat used to give an arrival over the Host,
    // and the only surface left that gives it: for those four seconds the news
    // is that somebody is here at all.
    expect(carouselFooterLine(ada, ada)).toEqual({
      text: 'Ada just joined!',
      greeting: true,
    });
  });
});
