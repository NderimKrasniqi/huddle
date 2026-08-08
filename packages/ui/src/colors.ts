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
  /** Warm off-white. The phone canvas, and the TV's letterbox bars. */
  canvas: '#FFF7F2',
  /**
   * The TV's own background. The same warm off-white, and deliberately its own
   * name: on the TV this is only ever seen through the gaps in
   * `tv-backgrounds/`, which *is* the canvas there rather than decoration over
   * one. A television that ever paints this flat is a television whose
   * background image failed to load.
   */
  screen: '#FFF7F2',
  /** Cards, sheets, inputs, tiles. */
  surface: '#FFFFFF',
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
} as const;

export type ColorToken = keyof typeof colors;
