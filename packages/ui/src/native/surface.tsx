import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { elevation } from '../shadows';

/**
 * A Soft Minimal surface — card, tile, sheet, button, input — with its shadow.
 *
 * This is what is left of `StickerSurface`, and almost all of that component
 * was scaffolding for two things Soft Minimal does not do.
 *
 * The first was the hard offset shadow, painted as a sibling `View` displaced
 * down and right. A real blurred shadow is one style property, so the sibling,
 * the rectangle maths and the wrapper that shrink-wrapped them all go.
 *
 * The second was the seam. Soft Minimal stroked 2–4px of ink around a white fill,
 * and a view that both fills and strokes paints its background across the whole
 * rounded rect before stroking inside it — at the antialiased boundary the fill
 * out-covers the stroke and a sub-pixel sliver escapes past the ink. The fix
 * was to set the surface's background *to the border colour*, make the border
 * transparent, and lay the real fill in behind the content inset to the padding
 * box. All of that is gone too, and deliberately: the seam was visible because
 * a pale sliver was escaping past near-black. Here the border is `#E9E6E2` on a
 * `#FFF7F2` canvas, so the worst the same leak can do is put warm white next to
 * warm grey. The bug is still physically there; it no longer has the contrast
 * to be a defect.
 *
 * What remains is one view. `wrapperStyle` went with the wrapper — there is no
 * second box for layout to attach to, so layout goes on `style` like everything
 * else.
 */
export type SurfaceProps = {
  /** A preset from `elevation`. */
  readonly elevation: (typeof elevation)[keyof typeof elevation];
  readonly style?: StyleProp<ViewStyle>;
  readonly children?: ReactNode;
};

export function Surface({ elevation: shadow, style, children }: SurfaceProps) {
  return <View style={[styles.surface, { boxShadow: shadow }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  // The shadow is drawn outside the border box, so a surface that clips its
  // children must opt into it — clipping here would clip the shadow away.
  surface: { overflow: 'visible' },
});
