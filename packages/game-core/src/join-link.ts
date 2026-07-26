/**
 * The Join Link: the deep link that puts a phone into a room. The TV encodes it
 * in the QR on its pairing screen; the Controller registers the scheme and
 * opens the join screen with the code prefilled.
 *
 * It lives beside the Room Code format because it is protocol, not decoration —
 * one side builds the string and the other parses it, and they must agree.
 */

/**
 * The URL scheme both apps register. It is duplicated in each app's `app.json`
 * (`expo.scheme`), which the native projects are generated from and which this
 * package cannot reach into; `join-link.test.ts` asserts the two never drift.
 */
export const JOIN_LINK_SCHEME = 'huddle';

/** The Join Link for a room, e.g. `huddle://join/KWRD`. */
export function roomJoinLink(code: string): string {
  return `${JOIN_LINK_SCHEME}://join/${code}`;
}
