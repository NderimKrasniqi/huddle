import { colors } from './colors';

/**
 * Soft Minimal's shadows: soft, blurred, and cast straight down.
 *
 * Soft Minimal's were the opposite — hard-edged, never blurred, displaced equally
 * down *and right* so a card read as a sticker lifted off the page. That is the
 * single loudest thing the old system did, and the handoff's "subtle shadows"
 * is a direct answer to it. Nothing here is offset sideways, nothing has a hard
 * edge, and the strongest shadow in the system is fainter than the weakest one
 * Soft Minimal drew.
 *
 * Values are `boxShadow` strings rather than the rectangle data Soft Minimal
 * needed. That machinery existed because the old shadow was painted as a
 * sibling `View` — a workaround inherited from a wrong theory about a seam,
 * kept only because it was equivalent. With a real blurred shadow there is
 * nothing to paint by hand, so it goes, and this module stays plain data that
 * runs under Node.
 */
export const elevation = {
  /** Resting surfaces: inputs, roster rows, chips, code tiles. */
  phoneSmall: `0px 1px 2px ${colors.shadowSoft}`,
  /** Phone cards and primary buttons. */
  phoneCard: `0px 2px 6px ${colors.shadowSoft}`,
  /** The phone's hero avatar. */
  phoneHero: `0px 4px 12px ${colors.shadowMedium}`,
  /** TV cards, which are read from across a room and carry a little more. */
  tvCard: `0px 3px 10px ${colors.shadowSoft}`,
  /** A TV card being called out. */
  tvCardHighlight: `0px 6px 18px ${colors.shadowMedium}`,
  /** The focused carousel card — the one thing on a TV screen that lifts. */
  tvHero: `0px 10px 30px ${colors.shadowStrong}`,
  /** A sheet over a scrim. */
  sheet: `0px 12px 32px ${colors.shadowStrong}`,
} as const;

export type ElevationToken = keyof typeof elevation;
