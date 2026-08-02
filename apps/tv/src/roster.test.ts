import { ROOM_PLAYER_CAP } from '@huddle/game-core';
import { describe, expect, it } from 'vitest';

import { footerSeatCount, footerSeatsWidth, rosterFooterText, seat } from './roster';

/**
 * `tvDesignSize.width` from @huddle/ui, written out: that package's entry point
 * also exports the Boardwalk font assets, which a Node test runner cannot load.
 */
const STAGE_WIDTH = 1280;

/** The screen gutter the pairing screen pads its header and footer with (handoff §1). */
const SCREEN_GUTTER = 56;

/** The gap between the seats and the count beside them, as the footer lays them out. */
const FOOTER_GAP = 24;

describe('footerSeatCount', () => {
  it('draws the handoff\'s four dashed seats while the room is nearly empty', () => {
    expect([0, 1, 2, 3, 4].map(footerSeatCount)).toEqual([4, 4, 4, 4, 4]);
  });

  it('draws a seat per player once the room is past four', () => {
    expect(footerSeatCount(5)).toBe(5);
    expect(footerSeatCount(ROOM_PLAYER_CAP)).toBe(ROOM_PLAYER_CAP);
  });
});

describe('the footer seat row', () => {
  it('fits a full room beside its count on the TV stage', () => {
    // No simulator exists on this machine, so the fit is checked as arithmetic
    // rather than seen. The budget for the count is an estimate, not a
    // measurement: "10 of 10 joined" is 15 characters of Space Grotesk at 22px,
    // whose advance averages well under 0.6em — call it 220px and leave room.
    const countBudget = 220;
    const available = STAGE_WIDTH - 2 * SCREEN_GUTTER;
    const full = footerSeatsWidth(footerSeatCount(ROOM_PLAYER_CAP));

    expect(full + FOOTER_GAP + countBudget).toBeLessThanOrEqual(available);
  });

  it('measures a row of seats as seats plus the gaps between them', () => {
    expect(footerSeatsWidth(1)).toBe(seat.size);
    expect(footerSeatsWidth(4)).toBe(4 * seat.size + 3 * seat.gap);
  });
});

describe('rosterFooterText', () => {
  it('reads as the handoff writes it while the room is empty', () => {
    expect(rosterFooterText(0)).toBe('0 of 10 joined — waiting for players…');
  });

  it('counts the players who have joined', () => {
    expect(rosterFooterText(1)).toBe('1 of 10 joined');
    expect(rosterFooterText(7)).toBe('7 of 10 joined');
  });

  it('stops waiting for players once the room is full', () => {
    expect(rosterFooterText(ROOM_PLAYER_CAP)).toBe('10 of 10 joined');
  });
});
