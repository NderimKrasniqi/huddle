import type { HostControlRejection } from '@huddle/game-core';
import { ConvexError } from 'convex/values';
import { describe, expect, it } from 'vitest';

import { hostControlFailureMessage, hostControlRejectionMessage } from './host-control-rejection';

/**
 * What the Host's phone says when transferring the room or removing a player
 * does not happen.
 *
 * Held to the same shape as `game-rejection.test.ts`: a `kind` off
 * `ConvexError.data`, never a message somebody may reword.
 */

/** Every refusal the server can send, one of each. */
const EVERY_REJECTION: readonly HostControlRejection[] = [
  { kind: 'notInRoom' },
  { kind: 'notHost' },
  { kind: 'targetNotInRoom' },
  { kind: 'targetIsSelf' },
  { kind: 'targetAway' },
];

describe('hostControlRejectionMessage', () => {
  it('says something the Host can act on for every kind', () => {
    // A silent tap is the one outcome a Host cannot make sense of, so even the
    // refusals no correct roster control produces get a sentence.
    for (const rejection of EVERY_REJECTION) {
      expect(hostControlRejectionMessage(rejection).length, rejection.kind).toBeGreaterThan(0);
    }
  });

  it('tells the two reachable refusals apart', () => {
    // A seat that left and a seat that went quiet are the two a live roster can
    // still tap, and they call for different remedies.
    expect(hostControlRejectionMessage({ kind: 'targetNotInRoom' })).toContain('already left');
    expect(hostControlRejectionMessage({ kind: 'targetAway' })).toContain('gone quiet');
  });
});

describe('hostControlFailureMessage', () => {
  it('reads the rejection off a ConvexError', () => {
    const thrown = new ConvexError<HostControlRejection>({ kind: 'notHost' });

    expect(hostControlFailureMessage(thrown)).toBe('Somebody else is running this room now.');
  });

  it('falls back to the connection line for anything else', () => {
    // A dropped websocket, a redacted server error, a thrown string: none is one
    // of the server's answers, and all are the same thing to the Host.
    expect(hostControlFailureMessage(new Error('boom'))).toContain('Could not reach the room');
    expect(hostControlFailureMessage('boom')).toContain('Could not reach the room');
  });

  it('does not take a plausible-looking stranger for a rejection', () => {
    // `data` is attacker-shaped in principle — the mutations are public. A kind
    // off the prototype chain is not one of ours.
    expect(hostControlFailureMessage(new ConvexError({ kind: 'toString' }))).toContain(
      'Could not reach the room',
    );
    expect(hostControlFailureMessage(new ConvexError({ kind: 'somethingElse' }))).toContain(
      'Could not reach the room',
    );
  });
});
