import type { GameLifecycleRejection, GameSetupRejection } from '@huddle/domain';
import { ConvexError } from 'convex/values';
import { describe, expect, it } from 'vitest';

import { lifecycleFailureMessage, rejectionMessage } from './game-rejection';

/**
 * What the Host's phone says when starting or ending a game does not happen.
 *
 * Held to the same shape as `join-rejection.test.ts` and
 * `host-control-rejection.test.ts`, because the module is: a `kind` off
 * `ConvexError.data`, never a message somebody may reword.
 */

/** Every refusal the server can send, one of each. */
const EVERY_REJECTION: readonly GameLifecycleRejection[] = [
  { kind: 'notInRoom' },
  { kind: 'notHost' },
  { kind: 'gameNotInstalled', gameId: 'charades' },
  { kind: 'alreadyInGame' },
  { kind: 'notEnoughPlayers', need: 2, have: 1 },
  { kind: 'tooManyPlayers', max: 4, have: 6 },
  { kind: 'settingRejected', key: 'questionCount', value: '7' },
];

const EVERY_SETUP_REJECTION: readonly GameSetupRejection[] = [
  { kind: 'setupNotFound' },
  { kind: 'setupAlreadyRunning' },
  { kind: 'replayNotFinished' },
  { kind: 'replayNotAllowed' },
];

describe('rejectionMessage', () => {
  it('counts the players a room is short, in the plural it needs', () => {
    // The only refusal the button does not already prevent, and the only one
    // whose words change with the room.
    expect(rejectionMessage({ kind: 'notEnoughPlayers', need: 2, have: 1 })).toBe(
      'One more player needs to join first.',
    );
    expect(rejectionMessage({ kind: 'notEnoughPlayers', need: 4, have: 1 })).toBe(
      '3 more players need to join first.',
    );
  });

  it('tells a Host whose settings the room would not take to update', () => {
    // Only reachable from a phone whose settings screen was drawn off another
    // build's schema — the same story as a game this room does not install, and
    // it gets the same answer.
    expect(rejectionMessage({ kind: 'settingRejected', key: 'questionCount', value: '7' })).toBe(
      'This room can’t play that game that way. Update Huddle and try again.',
    );
  });

  it('counts the players a room has above the game maximum', () => {
    expect(rejectionMessage({ kind: 'tooManyPlayers', max: 4, have: 5 })).toBe(
      'This game supports up to 4 players. Remove one player first.',
    );
    expect(rejectionMessage({ kind: 'tooManyPlayers', max: 4, have: 6 })).toBe(
      'This game supports up to 4 players. Remove 2 players first.',
    );
  });

  it('says something the Host can act on for every kind', () => {
    // A silent tap is the one outcome a Host cannot make sense of, so even the
    // refusals no correct Phone produces get a sentence.
    for (const rejection of EVERY_REJECTION) {
      expect(rejectionMessage(rejection).length, rejection.kind).toBeGreaterThan(0);
    }
    for (const rejection of EVERY_SETUP_REJECTION) {
      expect(rejectionMessage(rejection).length, rejection.kind).toBeGreaterThan(0);
    }
  });
});

describe('lifecycleFailureMessage', () => {
  it('reads the rejection off a ConvexError', () => {
    const thrown = new ConvexError<GameLifecycleRejection>({ kind: 'notHost' });

    expect(lifecycleFailureMessage(thrown)).toBe('Somebody else is running this room now.');
  });

  it('reads setup and replay refusals off a ConvexError too', () => {
    expect(lifecycleFailureMessage(new ConvexError<GameSetupRejection>({ kind: 'setupNotFound' }))).toBe(
      'Choose a game before configuring it.',
    );
    expect(lifecycleFailureMessage(new ConvexError<GameSetupRejection>({ kind: 'replayNotAllowed' }))).toBe(
      'The current roster cannot replay this game.',
    );
  });

  it('reads a settings refusal off one too', () => {
    const thrown = new ConvexError<GameLifecycleRejection>({
      kind: 'settingRejected',
      key: 'category',
      value: 'Sport',
    });

    expect(lifecycleFailureMessage(thrown)).toContain('can’t play that game that way');
  });

  it('falls back to the connection line for anything else', () => {
    // A dropped websocket, a redacted server error, a thrown string: none of
    // them is one of the server's answers, and all of them are the same thing
    // to the Host.
    expect(lifecycleFailureMessage(new Error('boom'))).toContain('Could not reach the room');
    expect(lifecycleFailureMessage('boom')).toContain('Could not reach the room');
  });

  it('does not take a plausible-looking stranger for a rejection', () => {
    // `data` is attacker-shaped in principle — the mutations are public. A kind
    // off the prototype chain is not one of ours.
    expect(lifecycleFailureMessage(new ConvexError({ kind: 'toString' }))).toContain(
      'Could not reach the room',
    );
    expect(lifecycleFailureMessage(new ConvexError({ kind: 'somethingElse' }))).toContain(
      'Could not reach the room',
    );
  });
});
