import { colors } from './colors';

/**
 * A single hard-edged offset shadow, shaped to React Native's `boxShadow`
 * style prop. Declared structurally (rather than importing RN's
 * `BoxShadowValue`) so this package stays plain TypeScript with no React
 * Native dependency — which is also what keeps it unit-testable under Node.
 */
export type OffsetShadow = {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly blurRadius: number;
  readonly color: string;
};

/**
 * Boardwalk's signature shadow: `Npx Npx 0 <color>` — hard-edged, never
 * blurred, ink by default but sometimes an accent (pink on the "JUST JOINED!"
 * card, cobalt on the focused carousel card).
 *
 * Built on the `boxShadow` style prop because it is the only primitive that
 * renders this on both of Huddle's targets. Android's `elevation` is always
 * blurred and does not reliably honour a shadow color, and iOS's
 * `shadowOffset`/`shadowRadius` family has no Android counterpart at all.
 * `boxShadow` is implemented in Fabric for iOS and Android (API 28+), and both
 * apps run the New Architecture on 0.86 — react-native 0.86.0 on the phone and
 * react-native-tvos 0.86.0-2 on the TV — so a single call site covers both.
 */
export function offsetShadow(
  distance: number,
  color: string = colors.ink,
): readonly OffsetShadow[] {
  return [{ offsetX: distance, offsetY: distance, blurRadius: 0, color }];
}

/**
 * Every shadow distance the handoff gives a number for, named by the surface
 * it belongs to. Where the handoff asks for a shadow without naming a distance
 * (the room-code chip, the color swatches, the game picker's round buttons),
 * use the preset for that surface.
 */
export const shadowDepth = {
  /** 3px — small phone elements: inputs, roster rows, chips. */
  phoneSmall: 3,
  /** 4px — phone cards and primary buttons. */
  phoneCard: 4,
  /** 5px — the phone's hero avatar circle on "You're in". */
  phoneHero: 5,
  /** 6px — TV cards: code tiles, player cards, the QR card. */
  tvCard: 6,
  /** 8px — a highlighted TV card, in its accent color (the "JUST JOINED!" card). */
  tvCardHighlight: 8,
  /** 10px — the TV hero card (the focused carousel card). */
  tvHero: 10,
} as const;
