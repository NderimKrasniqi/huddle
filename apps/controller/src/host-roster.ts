import type { RosterSeat } from './host';

/**
 * The Host's roster (docs/design/design-handoff.md §5): one row per player,
 * what each row's right-hand slot says, and the count line under them.
 *
 * It is the only surface in Huddle that says a *non-Host* player is away
 * between games, and that is why it exists rather than because §5 draws it.
 * The television used to say it on its pairing seats — a dimmed face and a
 * muted dot — but the carousel replaces that screen at the first join, so those
 * seats are unreachable in any shipped build, and the task above this one
 * dropped the away treatment from the television outright (see the Carousel
 * Footer Line in docs/CONTEXT.md). A lobby where somebody has put their phone
 * down would otherwise look, everywhere in the product, exactly like one where
 * nobody has — and the person who needs to know is the one deciding whether to
 * start.
 *
 * The rows themselves are the room's, in the order `players.roster` serves
 * them, which is join order — so the roster on the phone and the seats on the
 * television list the same party the same way round.
 */

/**
 * What a row's right-hand slot says (§5: "right slot = HOST pill / green online
 * dot / pink NEW! pill").
 *
 * `away` is not one of §5's three, and it is not an invention either: it is the
 * Status Dot's own muted variant (docs/CONTEXT.md), which the system already
 * decided is how a listed player's presence reads. The pink NEW! pill is the
 * one of the three that is *not* here — see the departure recorded against §5.
 */
export type RosterRowSlot = 'host' | 'present' | 'away';

/**
 * What this player's row has to say.
 *
 * The Host's pill wins over their own away-ness, and that costs nothing rather
 * than hiding something: this roster is drawn on the Host's phone alone, so the
 * row marked `host` is the reader's own, and a phone with this screen in front
 * of its owner is one the room is hearing from. The case where it is not — a
 * room whose whole party has gone quiet keeps its away Host, because being away
 * is not resigning — is a room with nobody in it to read the screen.
 *
 * Away-ness is therefore never the thing the slot gives up: every row that can
 * meaningfully be away is a row with a dot on it.
 */
export function rosterRowSlot(seat: RosterSeat): RosterRowSlot {
  if (seat.host) {
    return 'host';
  }

  return seat.away ? 'away' : 'present';
}

/** What each slot reads as aloud. §5's own word for the green dot is "online". */
const SPOKEN_SLOT: Readonly<Record<RosterRowSlot, string>> = {
  host: 'host',
  present: 'online',
  away: 'away',
};

/**
 * The row as a screen reader takes it: the nickname, and what its slot says.
 *
 * It exists because the slot's two dots differ in colour and in nothing else —
 * Boardwalk green against the muted border grey — and away-ness is the one
 * thing this roster was built to carry. A row that says it in a hue alone says
 * it to some of the room.
 */
export function rosterRowSpokenAs(seat: RosterSeat): string {
  return `${seat.nickname}, ${SPOKEN_SLOT[rosterRowSlot(seat)]}`;
}

/**
 * The line under the rows (§5: "<n> players in — you can start anytime").
 *
 * The invitation is dropped when it is false, the way §1's footer drops
 * "waiting for players…" once somebody is in: the start control directly below
 * this line already says what a room too small for its game is short of, and
 * two lines disagreeing about whether the party can begin is worse than one
 * line saying less. What is left is the count, which is true on every room.
 */
export function rosterFooterLine(joined: number, canStart: boolean): string {
  const count = `${joined} ${joined === 1 ? 'player' : 'players'} in`;

  return canStart ? `${count} — you can start anytime` : count;
}
