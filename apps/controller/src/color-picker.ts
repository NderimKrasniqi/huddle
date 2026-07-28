import { PLAYER_COLOR_NAMES, type PlayerColorName } from '@huddle/game-core';

import type { RosterSeat } from './host';

/**
 * The picker, as logic: which of the ten swatches the player looking at it may
 * take.
 *
 * It is worked out from the roster rather than from anything the phone
 * remembers, because the answer changes under them — the swatch somebody taps
 * may have been claimed across the room a moment earlier. The roster is the
 * room's own answer to "who holds what", which is the same answer `claimColor`
 * rules by, so what the picker dims is exactly what the server would refuse.
 */

/** How a swatch is drawn: the player's own, somebody else's, or there for the taking. */
export type SwatchState = 'yours' | 'taken' | 'free';

/** One swatch of the picker. */
export type Swatch = {
  readonly name: PlayerColorName;
  readonly state: SwatchState;
};

/**
 * The ten swatches in palette order, each with its state for `playerId`.
 *
 * A player's own color is `yours` rather than `taken`, because the two are
 * drawn differently and mean opposite things: one is the choice they made, the
 * other is a choice they cannot make.
 */
export function pickerSwatches(
  roster: readonly RosterSeat[],
  playerId: RosterSeat['playerId'],
): readonly Swatch[] {
  const mine = yourColor(roster, playerId);
  const theirs = new Set(
    roster
      .filter((seat) => seat.playerId !== playerId)
      .map((seat) => seat.color)
      .filter((color) => color !== undefined),
  );

  return PLAYER_COLOR_NAMES.map((name) => ({
    name,
    state: name === mine ? 'yours' : theirs.has(name) ? 'taken' : 'free',
  }));
}

/** The color this player holds, or `undefined` before they have picked one. */
export function yourColor(
  roster: readonly RosterSeat[],
  playerId: RosterSeat['playerId'],
): PlayerColorName | undefined {
  return roster.find((seat) => seat.playerId === playerId)?.color;
}
