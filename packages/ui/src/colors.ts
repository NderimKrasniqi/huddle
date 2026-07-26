/**
 * Boardwalk's palette, extracted from docs/design/design-handoff.md.
 *
 * This file is the only place in Huddle allowed to hold a hex color literal;
 * `color-literals.test.ts` enforces that across the whole repo.
 */
export const colors = {
  /** Outer page background. */
  canvas: '#EDE5D4',
  /** TV screen background — a shade lighter than the canvas. */
  screen: '#F7F1E6',
  /** Cards, tiles, inputs. */
  surface: '#FFFFFF',
  /** Borders, text, offset shadows. */
  ink: '#1B1B18',
  /** Secondary text. */
  mutedText: '#6E6653',
  /** Dashed borders on empty avatar circles and seats. */
  mutedBorder: '#C9BFAC',
  /** Primary action, room-code letters. */
  cobalt: '#2B4BF2',
  /** Brand accent, Host avatar, the period in "HUDDLE.". */
  tangerine: '#FF7A1A',
  /** Join and "just joined" highlights. */
  punch: '#E23D6D',
  /** Online status dots, avatars. */
  green: '#17A34A',
  /** Chip accent. */
  yellow: '#FFD84D',
} as const;

export type ColorToken = keyof typeof colors;
