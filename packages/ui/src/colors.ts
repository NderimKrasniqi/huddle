/**
 * Soft Minimal's palette, from docs/design/soft-minimal-handoff.md.
 *
 * This file is the only place in Huddle allowed to hold a hex color literal;
 * `color-literals.test.ts` enforces that across the whole repo.
 *
 * The six brand values are exact and approved. Everything below them is an
 * implementation value, which the handoff (§12) explicitly allows and which is
 * why each one says where it came from: a color invented here without a reason
 * is how a design system stops being one.
 */
export const colors = {
  /** Warm off-white. The phone canvas and the TV's native/loading fallback. */
  canvas: '#FFF7F2',
  /**
   * The TV's native/loading fallback. The full-viewport image in
   * `tv-backgrounds/` is the actual TV canvas; this token is shown only before
   * it resolves or if the asset fails.
   */
  screen: '#FFF7F2',
  /** Cards, sheets, inputs, tiles. */
  surface: '#FFFFFF',
  /** Warm Room cards and code tiles, sampled from the approved TV board. */
  roomSurface: '#FDFAF9',
  /** Soft peach — accent surfaces and avatar wells. */
  soft: '#FFE9DE',
  /** Deep navy. Text, headings, icons, room-code letters. */
  ink: '#0F172A',
  /** On orange and on navy. */
  inverse: '#FFFFFF',
  /**
   * Secondary text. Slate 500 to the ink's slate 900 — an implementation value,
   * but the one that is demonstrably the same family as the approved navy
   * rather than a grey picked to sit near it.
   */
  mutedText: '#64748B',
  /** Neutral caption ink on the Room's warm surface. */
  roomCaption: '#8A8E95',
  /** Warm grey. Borders, dividers, inactive surfaces. */
  border: '#E9E6E2',
  /** Sage. Decorative and supporting accent only — never a control. */
  sage: '#A7B3A6',
  /**
   * Brand orange. The single accent: primary actions, selection, focus, the
   * Host, and destructive confirmation — the approved board draws Remove in
   * orange rather than introducing a red, so Huddle has no danger color.
   */
  accent: '#FF6B4A',
  /** Online. */
  online: '#34A853',
  /** Just joined — the one informational blue in the system. */
  justJoined: '#2D9CDB',
  /** Away, and anything present but inactive. */
  away: '#A0A4AA',
  /** Gold crown above the Room Host's avatar. */
  hostCrown: '#F5A116',
  /** Blue Away chip surface and label on the Room roster. */
  awayChipSurface: '#EAF5FF',
  awayChipText: '#2587C8',
  /**
   * The ink a shadow is cast in, at the three weights `elevation` uses. The
   * navy carries its own alpha rather than a shadow taking a colour and an
   * opacity separately: a shadow is one value, and splitting it is how two
   * surfaces end up the same colour at different strengths by accident.
   *
   * Eight-digit hex because that is what React Native's `boxShadow` reads, and
   * `color-literals.test.ts` already counts 8 as a legal hex length.
   */
  shadowSoft: '#0F172A0F',
  shadowMedium: '#0F172A1A',
  shadowStrong: '#0F172A24',
} as const;

export type ColorToken = keyof typeof colors;
