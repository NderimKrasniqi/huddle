import type { GameLifecycleRejection, GameSetupRejection } from '@huddle/game-core';
import { ConvexError } from 'convex/values';

const UNEXPECTED_FAILURE = 'Could not reach the room. Check your connection and try again.';

export type ControllerGameRejection = GameLifecycleRejection | GameSetupRejection;

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

function isGameLifecycleRejection(data: unknown): data is ControllerGameRejection {
  return (
    typeof data === 'object' &&
    data !== null &&
    'kind' in data &&
    typeof data.kind === 'string' &&
    Object.hasOwn(REJECTION_KINDS, data.kind)
  );
}

/** A lifecycle/setup refusal in the words the Host reads. */
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

export function lifecycleFailureMessage(error: unknown): string {
  return error instanceof ConvexError && isGameLifecycleRejection(error.data)
    ? rejectionMessage(error.data)
    : UNEXPECTED_FAILURE;
}
