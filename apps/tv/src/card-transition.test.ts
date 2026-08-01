import { describe, expect, it } from 'vitest';

import { CARD_ENTRY_TRAVEL, cardEntryOffset } from './card-transition';

describe('cardEntryOffset', () => {
  it('starts the cards to the right when the room browses forward', () => {
    // The strip scrolls left to bring the next card to the middle, so the
    // content it is scrolling *from* is on the right — a positive offset that
    // animates to 0 is that scroll.
    expect(cardEntryOffset(0, 1)).toBe(CARD_ENTRY_TRAVEL);
  });

  it('starts the cards to the left when the room browses back', () => {
    expect(cardEntryOffset(1, 0)).toBe(-CARD_ENTRY_TRAVEL);
  });

  it('moves nothing when the index has not moved', () => {
    // A roster push, a heartbeat, a game ending: the carousel re-renders
    // constantly for reasons that are not the Host tapping an arrow, and none
    // of them is a card transition.
    expect(cardEntryOffset(2, 2)).toBe(0);
  });

  it('slides the same distance however far the index jumped', () => {
    // The index is clamped to what this build installs, so a phone browsing a
    // longer registry can move the room several cards at once. The animation
    // says which way the room went, not how far: a slide that scaled with the
    // jump would throw the cards off the television.
    expect(cardEntryOffset(0, 4)).toBe(CARD_ENTRY_TRAVEL);
    expect(cardEntryOffset(4, 0)).toBe(-CARD_ENTRY_TRAVEL);
  });
});
