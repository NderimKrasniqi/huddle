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
 * ## This whole module is scheduled for deletion
 *
 * Soft Minimal replaces claimed colors with claimed avatars: the choice moves
 * to the join form and a player is identified by a character, not a swatch
 * (`soft-minimal-handoff.md`, "Avatars replace colors"). That change also takes
 * `players.claimColor`, `color-picker.ts` and `color-rejection.ts` with it, and
 * it is a schema change rather than a palette one — so it is not this commit.
 *
 * Until it lands, every value is written out here rather than read from
 * `colors`. Five of them used to be Boardwalk accents, and those accents no
 * longer exist; pointing the other five at Soft Minimal tokens would spend real
 * effort making a doomed table look native, and would quietly claim that a
 * player's fill and the Join button's orange are meant to be the same value
 * again. They are not. These are ten Boardwalk colors living out their notice
 * period, and `packages/ui/src` is exempt from `color-literals.test.ts`
 * precisely so the theme can hold values.
 */
const PLAYER_COLORS: Record<PlayerColorName, PlayerColor> = {
  cobalt: { fill: '#2B4BF2', monogram: colors.surface },
  grape: { fill: '#6D3FD1', monogram: colors.surface },
  plum: { fill: '#B449C8', monogram: colors.surface },
  punch: { fill: '#E23D6D', monogram: colors.ink },
  tangerine: { fill: '#FF7A1A', monogram: colors.ink },
  yellow: { fill: '#FFD84D', monogram: colors.ink },
  lime: { fill: '#8DC63F', monogram: colors.ink },
  green: { fill: '#17A34A', monogram: colors.ink },
  lagoon: { fill: '#0FA3A3', monogram: colors.ink },
  sky: { fill: '#38B6FF', monogram: colors.ink },
};

/** How Boardwalk draws the color a player has claimed. */
export function playerColor(name: PlayerColorName): PlayerColor {
  return PLAYER_COLORS[name];
}

/**
 * Boardwalk's plain card face: white with an ink monogram, the same fill and
 * text every unclaimed surface in the system already wears.
 */
const UNCLAIMED_FACE: PlayerColor = { fill: colors.surface, monogram: colors.ink };

/**
 * The face a player is drawn with: the color they claimed, or the plain card
 * face until they have claimed one.
 *
 * Every surface that draws a player needs the second answer, because a player is
 * seated from the moment they join and picks a color afterwards — the TV's seats
 * fill up before anyone has touched a swatch. It is one answer rather than one
 * per screen so that "no color yet" cannot come to mean two different things in
 * the same room.
 */
export function playerFace(name: PlayerColorName | undefined): PlayerColor {
  return name === undefined ? UNCLAIMED_FACE : PLAYER_COLORS[name];
}

/**
 * Every claimable color in the order the picker draws them — game-core's own
 * order, which is the walk around the hue wheel that makes ten swatches read as
 * a spectrum.
 */
export const playerPalette: readonly (PlayerColor & { readonly name: PlayerColorName })[] =
  PLAYER_COLOR_NAMES.map((name) => ({ name, ...PLAYER_COLORS[name] }));
