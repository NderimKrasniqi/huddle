/**
 * The ten colors a player can claim, as names.
 *
 * Names and not values, because the two sides need different halves of the same
 * fact: a phone claims the swatch it tapped and the server rules on whether
 * anybody else holds it, neither of which needs to know what `lagoon` looks
 * like. What it looks like is Boardwalk's business, and lives in the one place
 * a color may be written down (`packages/ui`, which keys its palette off this
 * list). So this is protocol, like the Join Link and the Join Rejection, and it
 * lives where protocol lives.
 *
 * The order is the order the picker draws them in: a walk around the hue wheel,
 * so ten swatches read as a spectrum rather than a bag of colors.
 */
export const PLAYER_COLOR_NAMES = [
  'cobalt',
  'grape',
  'plum',
  'punch',
  'tangerine',
  'yellow',
  'lime',
  'green',
  'lagoon',
  'sky',
] as const;

/** One of the ten claimable colors. */
export type PlayerColorName = (typeof PLAYER_COLOR_NAMES)[number];

/**
 * Whether a string names a claimable color.
 *
 * The server asks because it cannot assume anybody asked before it: `claimColor`
 * is public and Huddle has no auth by design, so the picker's own list of ten
 * swatches is what the player sees, not a promise about what arrives.
 */
export function isPlayerColorName(value: string): value is PlayerColorName {
  return (PLAYER_COLOR_NAMES as readonly string[]).includes(value);
}
