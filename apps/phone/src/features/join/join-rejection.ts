import type { JoinRejection, RateLimitRejection } from '@huddle/domain';
import { refusalOf } from '@huddle/contracts/protocol';

const UNEXPECTED_FAILURE = 'Could not reach the room. Check your connection and try again.';

const REJECTION_KINDS: Readonly<Record<JoinRejection['kind'], true>> = {
  guestIdInvalid: true,
  roomNotFound: true,
  roomFull: true,
  nameTaken: true,
  nameUnusable: true,
  avatarTaken: true,
  avatarUnknown: true,
};

type PhoneJoinRejection = JoinRejection | RateLimitRejection;

function isJoinRejection(data: unknown): data is PhoneJoinRejection {
  return (
    typeof data === 'object' &&
    data !== null &&
    'kind' in data &&
    typeof data.kind === 'string' &&
    (Object.hasOwn(REJECTION_KINDS, data.kind) || data.kind === 'rateLimited')
  );
}

export function rejectionMessage(rejection: PhoneJoinRejection): string {
  switch (rejection.kind) {
    case 'guestIdInvalid':
      return 'Your local profile could not be read. Restart Huddle and try again.';
    case 'roomNotFound':
      return `No room has the code ${rejection.code}. Check the code on the TV.`;
    case 'roomFull':
      return `That room is full — ${rejection.cap} players is the limit.`;
    case 'nameTaken':
      return `${rejection.nickname} is already in that room. Pick another name.`;
    case 'nameUnusable':
      return `Pick a name of 1 to ${rejection.maxLength} characters.`;
    case 'avatarTaken':
      return 'Somebody just took that avatar. Pick another one.';
    case 'avatarUnknown':
      return 'That avatar is not available. Pick another one.';
    case 'rateLimited':
      return `This room is busy. Try joining again in ${Math.max(1, Math.ceil(rejection.retryAfterMs / 1_000))} seconds.`;
  }
}

export function joinFailureMessage(error: unknown): string {
  const rejection = refusalOf(error);
  return isJoinRejection(rejection) ? rejectionMessage(rejection) : UNEXPECTED_FAILURE;
}
