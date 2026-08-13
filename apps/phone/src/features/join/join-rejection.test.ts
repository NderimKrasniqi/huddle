import { type JoinRejection, NICKNAME_MAX_LENGTH, ROOM_PLAYER_CAP } from '@huddle/domain';
import { ConvexError } from 'convex/values';
import { describe, expect, it } from 'vitest';

import { joinFailureMessage, rejectionMessage } from './join-rejection';

/** A rejection as it reaches the screen: thrown by the server, caught by the join. */
function thrown(rejection: JoinRejection): unknown {
  return new ConvexError<JoinRejection>(rejection);
}

/** Every rejection `joinRoom` can throw (convex/convex/players.ts). */
const everyRejection: readonly JoinRejection[] = [
  { kind: 'roomNotFound', code: 'ZZZZ' },
  { kind: 'roomFull', cap: ROOM_PLAYER_CAP },
  { kind: 'nameTaken', nickname: 'Ada' },
  { kind: 'nameUnusable', maxLength: NICKNAME_MAX_LENGTH },
];

describe('rejectionMessage', () => {
  it('names the code nobody answered to', () => {
    expect(rejectionMessage({ kind: 'roomNotFound', code: 'KWRD' })).toBe(
      'No room has the code KWRD. Check the code on the TV.',
    );
  });

  it('says how many players a room holds', () => {
    expect(rejectionMessage({ kind: 'roomFull', cap: ROOM_PLAYER_CAP })).toBe(
      'That room is full — 10 players is the limit.',
    );
  });

  it('names the nickname somebody already wears', () => {
    expect(rejectionMessage({ kind: 'nameTaken', nickname: 'Ada' })).toBe(
      'Ada is already in that room. Pick another name.',
    );
  });

  it('says what a usable name looks like', () => {
    expect(rejectionMessage({ kind: 'nameUnusable', maxLength: NICKNAME_MAX_LENGTH })).toBe(
      'Pick a name of 1 to 20 characters.',
    );
  });
});

describe('joinFailureMessage', () => {
  /**
   * The acceptance criterion itself: every rejection the server can throw is
   * recognised on the wire and reaches the player as its own copy. Each case
   * goes through a real `ConvexError`, so the `data` unwrapping is exercised
   * rather than assumed.
   */
  it.each(everyRejection)('surfaces a $kind rejection as its own copy', (rejection) => {
    expect(joinFailureMessage(thrown(rejection))).toBe(rejectionMessage(rejection));
  });

  it('chooses the copy by kind, not by what the error says', () => {
    const misleading = new ConvexError<JoinRejection>({ kind: 'roomFull', cap: ROOM_PLAYER_CAP });
    misleading.message = 'that name is taken';

    expect(joinFailureMessage(misleading)).toBe('That room is full — 10 players is the limit.');
  });

  it('falls back to something a player can act on when the failure is not a rejection', () => {
    const generic = 'Could not reach the room. Check your connection and try again.';

    expect(joinFailureMessage(new Error('Server Error'))).toBe(generic);
    expect(joinFailureMessage(undefined)).toBe(generic);
    expect(joinFailureMessage(new ConvexError('Server Error'))).toBe(generic);
    expect(joinFailureMessage(new ConvexError({ kind: 'somethingNewer' }))).toBe(generic);
    // A kind borrowed from Object's prototype is still not one of ours.
    expect(joinFailureMessage(new ConvexError({ kind: 'toString' }))).toBe(generic);
  });
});
