import { describe, expect, it } from 'vitest';

import { browsingIndex, carouselWindow, nextIndex, previousIndex } from './carousel';
import { GAME_REGISTRY } from './registry';

const LAST = GAME_REGISTRY.length - 1;

describe('the index the room stores', () => {
  it('is the first card in a room nobody has browsed in', () => {
    expect(browsingIndex(undefined)).toBe(0);
    // A room read out of Convex has `null` for a field it never set.
    expect(browsingIndex(null)).toBe(0);
  });

  it('clamps an index the Registry does not have', () => {
    // A phone that browsed past what this build installs is not doing anything
    // wrong, and the honest answer is the nearest card rather than an error on
    // a television.
    expect(browsingIndex(99)).toBe(LAST);
    expect(browsingIndex(-3)).toBe(0);
  });

  it('refuses to be confused by what a client might send', () => {
    expect(browsingIndex(Number.NaN)).toBe(0);
    expect(browsingIndex(Number.POSITIVE_INFINITY)).toBe(LAST);
    expect(browsingIndex(1.9)).toBe(Math.min(1, LAST));
  });
});

describe('the carousel window', () => {
  it('focuses the game the index names', () => {
    expect(carouselWindow(0)?.focused).toBe(GAME_REGISTRY[0]);
  });

  it('has no side cards with a single game installed', () => {
    const window = carouselWindow(0);

    // The whole of "renders correctly with the registry's single MVP entry":
    // absent side cards, not duplicates of the focused one.
    expect(window?.previous).toBeUndefined();
    expect(window?.next).toBeUndefined();
    expect(window?.total).toBe(GAME_REGISTRY.length);
  });

  it('reports the index it settled on, not the one it was given', () => {
    // The screens draw page dots off this, so it has to be the clamped one.
    expect(carouselWindow(99)?.index).toBe(LAST);
  });
});

describe('where the Host’s arrows go', () => {
  it('has nowhere to go back from the first card', () => {
    expect(previousIndex(0)).toBeUndefined();
  });

  it('has nowhere to go on from the last card', () => {
    // With one game installed this is also the first card, and both arrows are
    // dead — which is correct: a list of one that wrapped would give the Host
    // two buttons that changed nothing.
    expect(nextIndex(LAST)).toBeUndefined();
  });

  it('steps one card at a time when there is somewhere to step', () => {
    // Vacuous at one installed game, and the arithmetic that has to be right
    // the first time a second one lands.
    if (GAME_REGISTRY.length > 1) {
      expect(nextIndex(0)).toBe(1);
      expect(previousIndex(1)).toBe(0);
    } else {
      expect(nextIndex(0)).toBeUndefined();
    }
  });
});
