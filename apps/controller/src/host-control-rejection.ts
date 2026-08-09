import type { HostControlRejection } from '@huddle/game-core';
import { ConvexError } from 'convex/values';

/**
 * What the Host's phone says when transferring the room or removing a player
 * does not happen.
 *
 * Built exactly like `game-rejection.ts`, `color-rejection.ts` and
 * `join-rejection.ts`: the failure is told apart by `kind` off
 * `ConvexError.data`, never by matching a message somebody may reword.
 */

/** When the failure is not one of the server's answers, but the trip itself. */
const UNEXPECTED_FAILURE = 'Could not reach the room. Check your connection and try again.';

/**
 * The `kind`s as values. Keyed by the union so a kind added to
 * `HostControlRejection` and not to this record is a compile error rather than a
 * silent fall-through to the generic line.
 */
const REJECTION_KINDS: Readonly<Record<HostControlRejection['kind'], true>> = {
  notInRoom: true,
  notHost: true,
  targetNotInRoom: true,
  targetIsSelf: true,
  targetAway: true,
};

/** Whether `data` off a `ConvexError` is one of the host-control refusals. */
function isHostControlRejection(data: unknown): data is HostControlRejection {
  return (
    typeof data === 'object' &&
    data !== null &&
    'kind' in data &&
    typeof data.kind === 'string' &&
    // Own properties only, as in the others: every object has a `toString`, and
    // a rejection of that kind is not one of ours.
    Object.hasOwn(REJECTION_KINDS, data.kind)
  );
}

/**
 * A refusal in the words the Host reads.
 *
 * None of these is a refusal the roster's own controls set out to earn — the
 * host acts off the room's live subscription, so the pill and the seats are
 * already the truth. They are reachable anyway: a seat can leave between the
 * render and the tap (`targetNotInRoom`, `targetAway`), and the mutations are
 * public, so a phone that is not the Host can call them (`notHost`,
 * `notInRoom`). Each gets a line, because a silent tap is the one outcome a Host
 * cannot make sense of. `targetIsSelf` is a control the roster should never
 * offer on the Host's own row; it gets a line for the same reason.
 */
export function hostControlRejectionMessage(rejection: HostControlRejection): string {
  switch (rejection.kind) {
    case 'targetAway':
      return 'That player’s phone has gone quiet. You can hand the room to somebody who’s still here.';
    case 'targetNotInRoom':
      return 'That player has already left this room.';
    case 'targetIsSelf':
      return 'That’s you — pick another player.';
    case 'notHost':
      return 'Somebody else is running this room now.';
    case 'notInRoom':
      return 'You are not in this room any more. Reopen Huddle to join again.';
  }
}

/**
 * What to show when a Host control throws, whatever it threw — `transferHost`,
 * or `removePlayer`, which share the gate and so share the refusals.
 *
 * `LeaveRoomSheet` routes its failures through here too, and it is the one
 * caller that does *not* share that gate: `players.leaveRoom` is a phone acting
 * on its own seat and throws no `HostControlRejection` at all, so every failure
 * of it lands on the generic line below. If it ever gains a refusal kind, this
 * is where it has to be taught one rather than being silently generic.
 */
export function hostControlFailureMessage(error: unknown): string {
  return error instanceof ConvexError && isHostControlRejection(error.data)
    ? hostControlRejectionMessage(error.data)
    : UNEXPECTED_FAILURE;
}
