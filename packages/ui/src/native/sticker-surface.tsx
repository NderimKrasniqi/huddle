import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '../colors';
import { stickerShadowRect } from '../shadows';

/**
 * A Boardwalk surface — card, tile, badge, button, input — with its hard offset
 * shadow behind it, drawn so the join between the two is solid ink.
 *
 * **The border is never stroked.** A view that both fills and strokes paints its
 * `backgroundColor` across the whole rounded rect and then strokes the border
 * inside it; at the antialiased boundary the background out-covers the stroke,
 * so a sub-pixel sliver of *fill* escapes outside the ink. That the seam takes
 * the fill colour is how it was finally identified, after three wrong theories:
 * the white tiles leaked white (`(84,84,81)`, 75% ink over white — not over
 * cream) while the tangerine badge leaked orange (`(70,44,24)`), and predicting
 * that second measurement before taking it is what confirmed the cause. So the
 * surface's own background is set to the border colour and the border made
 * transparent, leaving one ink edge with nothing lighter able to escape past it.
 * The border *width* is kept, so the content box does not move, and the fill is
 * laid in behind the content, inset to the padding box.
 *
 * The shadow being a sibling rectangle rather than a `boxShadow` is *not* part
 * of that fix — it came from one of the wrong theories (that RN clips an outset
 * `box-shadow` to the border box, leaving two coincident antialiased edges), and
 * swapping it changed the seam by nothing at all. It is kept because it is
 * equivalent, costs no more, and leaves `shadows.ts` as plain Node-testable
 * data. Do not read it as load-bearing.
 *
 * Styles are split deliberately rather than flattened into one prop:
 *
 * - `style` is the surface: background, border, radius, padding, and any fixed
 *   width/height.
 * - `wrapperStyle` is everything that must apply to surface *and* shadow
 *   together — the sticker tilt above all, since rotating only the surface
 *   would swing it off its own shadow. Layout that positions the whole unit
 *   (`alignSelf`, `flex`) belongs here too.
 */
export type StickerSurfaceProps = {
  /** Shadow distance in design pixels; pass a `shadowDepth` preset. */
  readonly depth: number;
  /** Defaults to ink; accent variants pass punch or cobalt. */
  readonly shadowColor?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly wrapperStyle?: StyleProp<ViewStyle>;
  readonly children?: ReactNode;
};

export function StickerSurface({
  depth,
  shadowColor = colors.ink,
  style,
  wrapperStyle,
  children,
}: StickerSurfaceProps) {
  const surface = StyleSheet.flatten(style) ?? {};
  const { backgroundColor: fill, borderColor, borderWidth = 0, borderRadius = 0 } = surface;
  const rect = stickerShadowRect(depth);

  // Only a numeric radius can have the border width subtracted from it; a
  // percentage radius is left to the fill's own rounding.
  const innerRadius =
    typeof borderRadius === 'number' && typeof borderWidth === 'number'
      ? Math.max(0, borderRadius - borderWidth)
      : borderRadius;

  return (
    <View style={[styles.wrapper, wrapperStyle]}>
      <View
        // Purely decorative, and it protrudes past the surface on two sides —
        // neither the screen reader nor a press should ever find it.
        aria-hidden
        pointerEvents="none"
        style={[
          styles.shadow,
          {
            ...rect,
            backgroundColor: shadowColor,
            borderRadius,
          },
        ]}
      />
      <View style={[style, { backgroundColor: borderColor, borderColor: 'transparent' }]}>
        {fill === undefined ? null : (
          <View
            aria-hidden
            pointerEvents="none"
            // Absolute children lay out against the padding box, so the fill
            // stops exactly where the ink band ends and never covers it.
            style={[StyleSheet.absoluteFill, { backgroundColor: fill, borderRadius: innerRadius }]}
          />
        )}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The wrapper shrink-wraps the surface, so the shadow's negative insets land
  // exactly on the surface's edges. It must not clip: the shadow is meant to
  // hang outside these bounds, and it stays out of layout so converting a
  // surface never changes the spacing around it.
  wrapper: { position: 'relative', overflow: 'visible' },
  shadow: { position: 'absolute' },
});
