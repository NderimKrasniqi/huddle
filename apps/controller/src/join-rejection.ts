import type { JoinRejection } from '@huddle/game-core';
import { ConvexError } from 'convex/values';

/**
 * What the join screen says when a join does not happen.
 *
 * The rejection is read off `ConvexError.data` and told apart by its `kind`.
 * That is the whole reason `joinRoom` throws a discriminated union rather than
 * a sentence: Convex redacts the message of anything that is not a
 * `ConvexError` to "Server Error", and even a message that survives is English
 * somebody may reword. Matching on it would leave a player staring at a screen
 * that cannot tell "room full" from "name taken".
 */

/** When the failure is not one of the server's four answers, but the trip itself. */
const UNEXPECTED_FAILURE = 'Could not reach the room. Check your connection and try again.';

/**
 * The `kind`s as values — what a rejection arriving over the wire is recognised
 * by. A runtime check cannot be made out of a type, so the kinds are written
 * out; keying a record by the union is what keeps the list honest, because a
 * kind added to `JoinRejection` and not to this record is a missing property
 * and so a compile error. The copy below is exhaustive the same way, which
 * means a new rejection cannot reach a player through one and not the other.
 */
const REJECTION_KINDS: Readonly<Record<JoinRejection['kind'], true>> = {
  roomNotFound: true,
  roomFull: true,
  nameTaken: true,
  nameUnusable: true,
};

/**
 * Whether `data` off a `ConvexError` is one of `joinRoom`'s rejections.
 *
 * The `kind` is what is checked: it is the discriminant, and the payload beside
 * it is written by the same typed mutation that chose the kind. A stranger
 * throwing a plausible `kind` at the client can only make it read out its own
 * copy, which is a screen a player could have reached by typing a wrong code.
 */
function isJoinRejection(data: unknown): data is JoinRejection {
  return (
    typeof data === 'object' &&
    data !== null &&
    'kind' in data &&
    typeof data.kind === 'string' &&
    // Own properties only: `'toString' in REJECTION_KINDS` is true of every
    // object, and a rejection of kind "toString" is not one of ours.
    Object.hasOwn(REJECTION_KINDS, data.kind)
  );
}

/**
 * A rejection in the words the player reads. Every branch names the thing that
 * went wrong — the code, the cap, the name — because "could not join" tells
 * somebody standing in a living room nothing about what to do next.
 *
 * Exhaustive by construction: the function returns `string`, so a kind without
 * a branch is a compile error rather than a blank line on a phone.
 */
export function rejectionMessage(rejection: JoinRejection): string {
  switch (rejection.kind) {
    case 'roomNotFound':
      return `No room has the code ${rejection.code}. Check the code on the TV.`;
    case 'roomFull':
      return `That room is full — ${rejection.cap} players is the limit.`;
    case 'nameTaken':
      return `${rejection.nickname} is already in that room. Pick another name.`;
    case 'nameUnusable':
      return `Pick a name of 1 to ${rejection.maxLength} characters.`;
  }
}

/** What to show when `joinRoom` throws, whatever it threw. */
export function joinFailureMessage(error: unknown): string {
  return error instanceof ConvexError && isJoinRejection(error.data)
    ? rejectionMessage(error.data)
    : UNEXPECTED_FAILURE;
}
