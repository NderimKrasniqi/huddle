import type { GameLifecycleRejection } from '@huddle/game-core';
import { ConvexError } from 'convex/values';

/**
 * What the Host's phone says when starting or ending a game does not happen.
 *
 * Built exactly like `color-rejection.ts` and `join-rejection.ts`: the failure
 * is told apart by `kind` off `ConvexError.data`, never by matching a message
 * somebody may reword.
 */

/** When the failure is not one of the server's answers, but the trip itself. */
const UNEXPECTED_FAILURE = 'Could not reach the room. Check your connection and try again.';

/**
 * The `kind`s as values. Keyed by the union so a kind added to
 * `GameLifecycleRejection` and not to this record is a compile error rather
 * than a silent fall-through to the generic line.
 */
const REJECTION_KINDS: Readonly<Record<GameLifecycleRejection['kind'], true>> = {
  alreadyInGame: true,
  gameNotInstalled: true,
  notEnoughPlayers: true,
  notHost: true,
  notInRoom: true,
  settingRejected: true,
};

/** Whether `data` off a `ConvexError` is one of the lifecycle refusals. */
function isGameLifecycleRejection(data: unknown): data is GameLifecycleRejection {
  return (
    typeof data === 'object' &&
    data !== null &&
    'kind' in data &&
    typeof data.kind === 'string' &&
    // Own properties only, as in the other two: every object has a `toString`,
    // and a rejection of that kind is not one of ours.
    Object.hasOwn(REJECTION_KINDS, data.kind)
  );
}

/**
 * A refusal in the words the Host reads.
 *
 * `notEnoughPlayers` is the only one the button does not already prevent, and
 * it is reachable: the roster this phone drew its count from is a subscription,
 * so somebody can leave between the render and the tap. The rest are the server
 * declining to trust its callers — no correct Controller produces them, and
 * they get a line anyway, because a silent tap is the one outcome a Host cannot
 * make sense of.
 */
export function rejectionMessage(rejection: GameLifecycleRejection): string {
  switch (rejection.kind) {
    case 'notEnoughPlayers':
      return rejection.need - rejection.have === 1
        ? 'One more player needs to join first.'
        : `${rejection.need - rejection.have} more players need to join first.`;
    case 'alreadyInGame':
      return 'This room is already playing.';
    case 'gameNotInstalled':
      return 'This room can’t play that game. Update Huddle and try again.';
    case 'notHost':
      return 'Somebody else is running this room now.';
    case 'notInRoom':
      return 'You are not in this room any more. Reopen Huddle to join again.';
    case 'settingRejected':
      // Only reachable from a phone whose settings screen was drawn off a
      // different build's schema, which is the same story as `gameNotInstalled`
      // and gets the same answer. The key is not named: the Host cannot act on
      // it, and the control they used is on their screen either way.
      return 'This room can’t play that game that way. Update Huddle and try again.';
  }
}

/** What to show when `startGame` or `endGame` throws, whatever it threw. */
export function lifecycleFailureMessage(error: unknown): string {
  return error instanceof ConvexError && isGameLifecycleRejection(error.data)
    ? rejectionMessage(error.data)
    : UNEXPECTED_FAILURE;
}
