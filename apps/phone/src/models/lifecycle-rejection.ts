import type {
  GameLifecycleRejection,
  GameSetupRejection,
  RateLimitRejection,
} from '@huddle/domain';
import { ConvexError } from 'convex/values';

const UNEXPECTED_FAILURE = 'Could not reach the room. Check your connection and try again.';

export type PhoneGameRejection =
  | GameLifecycleRejection
  | GameSetupRejection
  | RateLimitRejection;

const REJECTION_KINDS: Readonly<Record<PhoneGameRejection['kind'], true>> = {
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
  setupLocked: true,
  setupNotReady: true,
  playersNotReady: true,
  playersAway: true,
  rateLimited: true,
};

function isGameLifecycleRejection(data: unknown): data is PhoneGameRejection {
  return (
    typeof data === 'object' &&
    data !== null &&
    'kind' in data &&
    typeof data.kind === 'string' &&
    Object.hasOwn(REJECTION_KINDS, data.kind)
  );
}

/** A lifecycle/setup refusal in the words the Host reads. */
export function rejectionMessage(rejection: PhoneGameRejection): string {
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
    case 'setupLocked':
      return 'This setup is locked. Reopen it before changing settings.';
    case 'setupNotReady':
      return 'Finish and lock the game setup before starting.';
    case 'playersNotReady':
      return rejection.playerIds.length === 1
        ? 'One player still needs to Ready.'
        : `${rejection.playerIds.length} players still need to Ready.`;
    case 'playersAway':
      return rejection.playerIds.length === 1
        ? 'One player is disconnected. Wait for them to return or remove their seat.'
        : `${rejection.playerIds.length} players are disconnected. Wait for them to return or remove their seats.`;
    case 'rateLimited':
      return `That was a little fast. Try again in ${Math.max(1, Math.ceil(rejection.retryAfterMs / 1_000))} seconds.`;
  }
}

export function lifecycleFailureMessage(error: unknown): string {
  return error instanceof ConvexError && isGameLifecycleRejection(error.data)
    ? rejectionMessage(error.data)
    : UNEXPECTED_FAILURE;
}
