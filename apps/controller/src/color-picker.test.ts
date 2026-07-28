import { PLAYER_COLOR_NAMES, type PlayerColorName } from '@huddle/game-core';
import { describe, expect, it } from 'vitest';

import { pickerSwatches, type SwatchState, yourColor } from './color-picker';
import type { RosterSeat } from './host';

/** A roster the way the room serves one, with each player's color where given. */
function seatsOf(...seats: readonly { name: string; color?: PlayerColorName }[]): RosterSeat[] {
  return seats.map(({ name, color }) => ({
    playerId: `player-${name}` as RosterSeat['playerId'],
    nickname: name,
    away: false,
    host: false,
    color,
  }));
}

function idOf(name: string): RosterSeat['playerId'] {
  return `player-${name}` as RosterSeat['playerId'];
}

/** The state the picker gives one swatch, for the player looking at it. */
function stateOf(
  roster: RosterSeat[],
  viewer: string,
  color: PlayerColorName,
): SwatchState | undefined {
  return pickerSwatches(roster, idOf(viewer)).find((swatch) => swatch.name === color)?.state;
}

describe('pickerSwatches', () => {
  it('draws all ten, in palette order', () => {
    // The order is the spectrum game-core lays out; a picker that re-sorted it
    // would scramble the swatches without failing anything else.
    const swatches = pickerSwatches(seatsOf({ name: 'Ada' }), idOf('Ada'));

    expect(swatches.map((swatch) => swatch.name)).toEqual([...PLAYER_COLOR_NAMES]);
  });

  it('offers every color in a room where nobody has picked', () => {
    const swatches = pickerSwatches(seatsOf({ name: 'Ada' }, { name: 'Grace' }), idOf('Ada'));

    expect(swatches.every((swatch) => swatch.state === 'free')).toBe(true);
  });

  it('marks the player’s own color theirs, not taken', () => {
    // The two are drawn differently and mean opposite things: one is the choice
    // they made, the other is a choice they cannot make.
    const roster = seatsOf({ name: 'Ada', color: 'lagoon' });

    expect(stateOf(roster, 'Ada', 'lagoon')).toBe('yours');
  });

  it('marks a color another player holds taken', () => {
    const roster = seatsOf({ name: 'Ada', color: 'lagoon' }, { name: 'Grace', color: 'punch' });

    expect(stateOf(roster, 'Ada', 'punch')).toBe('taken');
    expect(stateOf(roster, 'Grace', 'lagoon')).toBe('taken');
  });

  it('leaves the rest free while some are held', () => {
    const roster = seatsOf({ name: 'Ada', color: 'lagoon' }, { name: 'Grace', color: 'punch' });
    const swatches = pickerSwatches(roster, idOf('Ada'));

    expect(swatches.filter((swatch) => swatch.state === 'free')).toHaveLength(8);
  });

  it('frees a color the moment its holder moves off it', () => {
    // The picker is drawn from the roster and nothing else, so a claim made
    // across the room reaches this screen as the next value of a subscription.
    const before = seatsOf({ name: 'Ada' }, { name: 'Grace', color: 'yellow' });
    const after = seatsOf({ name: 'Ada' }, { name: 'Grace', color: 'grape' });

    expect(stateOf(before, 'Ada', 'yellow')).toBe('taken');
    expect(stateOf(after, 'Ada', 'yellow')).toBe('free');
  });

  it('offers everything while the roster has yet to arrive', () => {
    // An empty roster is not a room where every color is taken. Dimming the
    // whole picker for the round trip would read as a screen that is broken.
    const swatches = pickerSwatches([], idOf('Ada'));

    expect(swatches.every((swatch) => swatch.state === 'free')).toBe(true);
  });

  it('ignores an away player’s color no more than a present one’s', () => {
    // An away player keeps their seat, their score and their color: the room
    // still holds their place, so their swatch is still theirs.
    const roster = seatsOf({ name: 'Ada' }, { name: 'Grace', color: 'sky' });
    const away = roster.map((seat) => ({ ...seat, away: true }));

    expect(stateOf(away, 'Ada', 'sky')).toBe('taken');
  });
});

describe('yourColor', () => {
  it('is the color on this player’s own row', () => {
    const roster = seatsOf({ name: 'Ada', color: 'lime' }, { name: 'Grace', color: 'punch' });

    expect(yourColor(roster, idOf('Ada'))).toBe('lime');
  });

  it('is nothing before they have picked', () => {
    expect(yourColor(seatsOf({ name: 'Ada' }), idOf('Ada'))).toBeUndefined();
  });

  it('is nothing when the roster does not hold them', () => {
    expect(yourColor(seatsOf({ name: 'Grace', color: 'lime' }), idOf('Ada'))).toBeUndefined();
  });
});
