import { PLAYER_COLOR_NAMES, type PlayerColorName } from '@huddle/game-core';

import { colors } from './colors';

/**
 * The ten colors a player can claim, as Boardwalk draws them.
 *
 * game-core names them (they are protocol — a phone claims a name and the
 * server rules on it); this is what each name looks like. Five are the
 * Boardwalk accents the rest of the system already uses, and five extend them
 * around the hue wheel, in the same flat poster register.
 *
 * Each color carries the ink its monogram is set in, because one text color
 * cannot serve ten fills: ink on cobalt measures 2.8:1 and vanishes, white on
 * yellow measures 1.4:1 and vanishes harder. Pairing them here is what stops a
 * screen from having to work it out — and `player-colors.test.ts` holds every
 * pair to a contrast floor, so a color added later cannot quietly be
 * unreadable.
 */
export type PlayerColor = {
  /** The avatar circle and the swatch. */
  readonly fill: string;
  /** The color the Bungee initials on that fill are set in. */
  readonly monogram: string;
};

/**
 * The five Boardwalk accents are referenced through `colors` rather than
 * repeated, so a player's cobalt is the same cobalt as the Join button's. The
 * five additions are written here because this is the file that owns them — no
 * other surface has a use for `lagoon`.
 */
const PLAYER_COLORS: Record<PlayerColorName, PlayerColor> = {
  cobalt: { fill: colors.cobalt, monogram: colors.surface },
  grape: { fill: '#6D3FD1', monogram: colors.surface },
  plum: { fill: '#B449C8', monogram: colors.surface },
  punch: { fill: colors.punch, monogram: colors.ink },
  tangerine: { fill: colors.tangerine, monogram: colors.ink },
  yellow: { fill: colors.yellow, monogram: colors.ink },
  lime: { fill: '#8DC63F', monogram: colors.ink },
  green: { fill: colors.green, monogram: colors.ink },
  lagoon: { fill: '#0FA3A3', monogram: colors.ink },
  sky: { fill: '#38B6FF', monogram: colors.ink },
};

/** How Boardwalk draws the color a player has claimed. */
export function playerColor(name: PlayerColorName): PlayerColor {
  return PLAYER_COLORS[name];
}

/**
 * Every claimable color in the order the picker draws them — game-core's own
 * order, which is the walk around the hue wheel that makes ten swatches read as
 * a spectrum.
 */
export const playerPalette: readonly (PlayerColor & { readonly name: PlayerColorName })[] =
  PLAYER_COLOR_NAMES.map((name) => ({ name, ...PLAYER_COLORS[name] }));
