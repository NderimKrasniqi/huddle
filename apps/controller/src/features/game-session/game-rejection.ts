import type { GameLifecycleRejection, GameSetupRejection } from '@huddle/game-core';
import { ConvexError } from 'convex/values';

/**
 * What the Host's phone says when starting or ending a game does not happen.
 *
 * Built exactly like `host-control-rejection.ts` and `join-rejection.ts`: the failure
 * is told apart by `kind` off `ConvexError.data`, never by matching a message
 * somebody may reword.
 */

/** When the failure is not one of the server's answers, but the trip itself. */
const UNEXPECTED_FAILURE = 'Could not reach the room. Check your connection and try again.';

type ControllerGameRejection = GameLifecycleRejection | GameSetupRejection;

/**
 * The `kind`s as values. Keyed by the union so a kind added to
 * `GameLifecycleRejection` and not to this record is a compile error rather
 * than a silent fall-through to the generic line.
 */
const REJECTION_KINDS: Readonly<Record<ControllerGameRejection['kind'], true>> = {
  alreadyInGame: true,
  gameNotInstalled: true,
  notEnoughPlayers: true,
  notHost: true,
  notInRoom: true,
  settingRejected: true,
  setupAlreadyRunning: true,
  setupNotFound: true,
  tooManyPlayers: true,
  tvUnavailable: true,
  replayNotAllowed: true,
  replayNotFinished: true,
};

/** Whether `data` off a `ConvexError` is one of the lifecycle/setup refusals. */
function isGameLifecycleRejection(data: unknown): data is ControllerGameRejection {
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
 * Player-range refusals are the ones a correct Controller can still receive:
 * the roster this phone drew its count from is a subscription, so somebody can
 * join or leave between the render and the tap.
 *
 * `alreadyInGame` was briefly a second — deleting the unknown-game screen sent
 * a Host whose build lacks the running module to the ordinary lobby, Start
 * button and all. The Host's room now draws Back to lobby instead of the picker
 * in exactly that case (`stranded`), so there is again no correct Controller
 * that offers to start a room already playing.
 *
 * The rest are the server declining to trust its callers. They get a line
 * anyway, because a silent tap is the one outcome a Host cannot make sense of.
 */
export function rejectionMessage(rejection: ControllerGameRejection): string {
  switch (rejection.kind) {
    case 'notEnoughPlayers':
      return rejection.need - rejection.have === 1
        ? 'One more player needs to join first.'
        : `${rejection.need - rejection.have} more players need to join first.`;
    case 'tooManyPlayers': {
      const extra = rejection.have - rejection.max;
      return extra === 1
        ? `This game supports up to ${rejection.max} players. Remove one player first.`
        : `This game supports up to ${rejection.max} players. Remove ${extra} players first.`;
    }
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
    case 'setupNotFound':
      return 'Choose a game before configuring it.';
    case 'setupAlreadyRunning':
      return 'This room is already playing.';
    case 'replayNotFinished':
      return 'Replay is available after the game finishes.';
    case 'replayNotAllowed':
      return 'The current roster cannot replay this game.';
    case 'tvUnavailable':
      return 'The TV is reconnecting. Wait for it to return, then try again.';
  }
}

/** What to show when `startGame` or `endGame` throws, whatever it threw. */
export function lifecycleFailureMessage(error: unknown): string {
  return error instanceof ConvexError && isGameLifecycleRejection(error.data)
    ? rejectionMessage(error.data)
    : UNEXPECTED_FAILURE;
}
