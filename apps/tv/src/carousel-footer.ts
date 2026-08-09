import type { RosterSeat } from './roster';

/**
 * The carousel's footer line: the one sentence under the page dots
 * (`docs/design/reference/screens/02-game-carousel.png` — "Sam is browsing on
 * their phone.").
 *
 * It used to be a *slot* that an arrival could borrow for four seconds, and
 * that is no longer its job. Soft Minimal's television left the pairing screen at
 * the first join, so after the first player there were no seats anywhere on the
 * TV and a phone landing mid-lobby changed nothing on the screen the party was
 * looking at; this line was where that news went. Soft Minimal's Room keeps the
 * roster up until the Host starts browsing, so the greeting is back on the
 * arriving player's own seat (`just-joined.ts`), and the carousel — which draws
 * no roster at all — is left saying the one thing it is for.
 *
 * Which is also the honest division: a phone landing while the Host is
 * comparing game cards is not news the carousel has anywhere to put, and the
 * Room the party came from showed it.
 */

/**
 * What the line says.
 *
 * A room with no Host to name is a room whose first roster has not landed yet —
 * the carousel is only drawn for a room somebody is browsing in, and a room
 * with somebody in it has a Host. The screen says what it is waiting for rather
 * than leaving a gap where a sentence goes.
 */
export function carouselFooterLine(host: RosterSeat | undefined): string {
  return host === undefined ? 'Picking a game…' : `${host.nickname} is browsing on their phone.`;
}
