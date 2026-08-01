import { type Arrivals, isArrival } from './just-joined';
import type { RosterSeat } from './roster';

/**
 * The carousel's footer line: the one sentence under the page dots
 * (docs/design/design-handoff.md §6 — "page dots + '<Host> is browsing on their
 * phone'").
 *
 * It is a *slot* rather than a fixed sentence, and that is this module's whole
 * reason to exist. The handoff draws a room's news — the HOST pill, the "JUST
 * JOINED!" pill — on the §3 TV lobby card, and §3 is never coming: the focused
 * carousel card is 520 of the stage's 720 points, so a roster of 216×264 player
 * cards cannot share the screen with it, and the television therefore goes
 * pairing → carousel the moment anybody joins. Everything the pairing seats say
 * — the Host's tangerine shadow, an arrival's punch one, an away player's
 * dimming — goes with that screen.
 *
 * Two of those three survive the loss, because §6 already says them or the room
 * does not need them said (the reasoning is written out against the task in
 * docs/implementation-plan.md). The third does not: after the first join there
 * are no seats on the television at all, so a phone landing mid-lobby changes
 * nothing on the screen the party is looking at. That is what this line fixes.
 * For four seconds it belongs to the newest arrival, and then it goes back to
 * being §6's own sentence.
 *
 * It is a line and not a pill. A Boardwalk pill's box runs about 46pt at the
 * TV's 18px minimum, against the 28pt this line has: dropping one into the
 * footer would push it to 82pt, which puts the page dots back inside the
 * focused card's cobalt shadow — the exact collision the sibling half of that
 * task just bought 10pt of daylight out of. The pairing seat gave up the same
 * pill for the same kind of reason (a pill readable across a room does not fit
 * a 72px circle), so the pattern is the system's rather than this screen's.
 */

/** What the footer's line reads, and which of its two jobs it is doing. */
export type CarouselFooterLine = {
  readonly text: string;
  /**
   * An arrival's four seconds, rather than §6's own line — the screen draws
   * this one in punch pink, Boardwalk's "join/new highlight".
   */
  readonly greeting: boolean;
};

/**
 * Who the line greets: the newest player this screen watched arrive, or nobody.
 *
 * "Newest" is join order, which is the order the `roster` query serves, so the
 * last arrival on the roster is the one whose phone has only just landed. How
 * long the greeting lasts is not decided here — it is counted by the component
 * drawing it, exactly as a seat counts its own four seconds, because a live
 * query reports things happening and never four seconds of nothing happening.
 *
 * The answer only moves forward while a room lives: a player never leaves one,
 * and an expiring room takes the whole screen with it.
 *
 * It is *not* on its own the answer to who to greet — an arrival stays an
 * arrival for as long as they stay seated, so this keeps naming the same player
 * long after their four seconds are spent. `arrivalToGreet` is the one to ask.
 */
export function newestArrival(
  seen: Arrivals | undefined,
  roster: readonly RosterSeat[],
): RosterSeat | undefined {
  if (seen === undefined) {
    return undefined;
  }

  return [...roster].reverse().find(({ playerId }) => isArrival(seen, playerId));
}

/**
 * Who the line greets right now: the newest arrival, unless this screen has
 * already spent its four seconds on them.
 *
 * The second half is the whole difference between a greeting and an
 * announcement of nothing, because being an Arrival is permanent and the
 * greeting is not. The four seconds cannot be counted by whatever is drawing
 * them — the carousel is unmounted for the length of a game and mounted again
 * when it ends, so a mount would announce the room's last arrival every time a
 * game finished, and again on any blink that flashes the lobby. That is exactly
 * the case `just-joined.ts` already refuses for a seat: "a room coming back
 * from a game has not [seen ten people walk in] either."
 *
 * Which arrivals have been greeted is therefore held by the screen and passed
 * in, and this stays a question with one answer.
 */
export function arrivalToGreet(
  seen: Arrivals | undefined,
  roster: readonly RosterSeat[],
  greeted: ReadonlySet<RosterSeat['playerId']>,
): RosterSeat | undefined {
  const arrival = newestArrival(seen, roster);

  return arrival === undefined || greeted.has(arrival.playerId) ? undefined : arrival;
}

/**
 * What the line says: the arrival being greeted, else who is browsing.
 *
 * A room with no Host to name is a room whose first roster has not landed yet —
 * the carousel is only drawn for a room with somebody in it, and a room with
 * somebody in it has a Host. The screen says what it is waiting for rather than
 * leaving a gap where a sentence goes.
 *
 * An arrival comes first even when it is the Host's own, the way it does on a
 * seat (`seatHighlight`): the room's first player is both at once, and for
 * those four seconds the news is that somebody is here at all.
 */
export function carouselFooterLine(
  host: RosterSeat | undefined,
  greeted: RosterSeat | undefined,
): CarouselFooterLine {
  if (greeted !== undefined) {
    return { text: `${greeted.nickname} just joined!`, greeting: true };
  }

  return {
    text: host === undefined ? 'Picking a game…' : `${host.nickname} is browsing on their phone`,
    greeting: false,
  };
}
