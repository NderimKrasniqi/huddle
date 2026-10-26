import type { HostControlRejection, RateLimitRejection } from '@huddle/domain';
import { refusalOf } from '@huddle/contracts/protocol';

const UNEXPECTED_FAILURE = 'Could not reach the room. Check your connection and try again.';

const REJECTION_KINDS: Readonly<Record<HostControlRejection['kind'], true>> = {
  notInRoom: true,
  notHost: true,
  targetNotInRoom: true,
  targetIsSelf: true,
  targetAway: true,
};

type PhoneHostControlRejection = HostControlRejection | RateLimitRejection;

function isHostControlRejection(data: unknown): data is PhoneHostControlRejection {
  return (
    typeof data === 'object' &&
    data !== null &&
    'kind' in data &&
    typeof data.kind === 'string' &&
    (Object.hasOwn(REJECTION_KINDS, data.kind) || data.kind === 'rateLimited')
  );
}

export function hostControlRejectionMessage(rejection: PhoneHostControlRejection): string {
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
    case 'rateLimited':
      return `That was a little fast. Try again in ${Math.max(1, Math.ceil(rejection.retryAfterMs / 1_000))} seconds.`;
  }
}

export function hostControlFailureMessage(error: unknown): string {
  const rejection = refusalOf(error);
  return isHostControlRejection(rejection) ? hostControlRejectionMessage(rejection) : UNEXPECTED_FAILURE;
}
