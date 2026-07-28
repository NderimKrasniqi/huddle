import type { ColorRejection } from '@huddle/game-core';
import { ConvexError } from 'convex/values';
import { describe, expect, it } from 'vitest';

import { claimFailureMessage, rejectionMessage } from './color-rejection';

describe('rejectionMessage', () => {
  it('tells a player who lost a race what happened, and what to do', () => {
    // The only refusal anybody should ever meet: the picker dims what is held,
    // so reaching this means two thumbs landed inside a round trip.
    expect(rejectionMessage({ kind: 'colorTaken', color: 'punch' })).toBe(
      'Somebody just took that one. Pick another.',
    );
  });

  it('says something a player can act on for every kind', () => {
    const kinds: readonly ColorRejection[] = [
      { kind: 'colorTaken', color: 'punch' },
      { kind: 'colorUnknown', color: 'chartreuse' },
      { kind: 'notInRoom' },
    ];

    // A silent tap is the one outcome a player cannot make sense of, so even
    // the two no correct Controller produces get a sentence.
    for (const rejection of kinds) {
      expect(rejectionMessage(rejection).length).toBeGreaterThan(0);
    }
  });
});

describe('claimFailureMessage', () => {
  it('reads the rejection off a ConvexError', () => {
    const thrown = new ConvexError<ColorRejection>({ kind: 'colorTaken', color: 'sky' });

    expect(claimFailureMessage(thrown)).toBe('Somebody just took that one. Pick another.');
  });

  it('falls back to the connection line for anything else', () => {
    // A dropped websocket, a redacted server error, a thrown string: none of
    // them is one of the server's answers, and all of them are the same thing
    // to the player.
    expect(claimFailureMessage(new Error('boom'))).toContain('Could not reach the room');
    expect(claimFailureMessage('boom')).toContain('Could not reach the room');
  });

  it('does not take a plausible-looking stranger for a rejection', () => {
    // `data` is attacker-shaped in principle — the mutation is public. A kind
    // off the prototype chain is not one of ours.
    expect(claimFailureMessage(new ConvexError({ kind: 'toString' }))).toContain(
      'Could not reach the room',
    );
    expect(claimFailureMessage(new ConvexError({ kind: 'somethingElse' }))).toContain(
      'Could not reach the room',
    );
  });
});
