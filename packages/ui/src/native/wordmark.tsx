import { Image, StyleSheet, type StyleProp, type ImageStyle } from 'react-native';

import logoDark from '../../assets/logo/huddle-logo-dark.png';
import logoLight from '../../assets/logo/huddle-logo-light.png';

/**
 * The HUDDLE wordmark, as artwork.
 *
 * §5 of the handoff is explicit that the wordmark uses supplied brand artwork
 * rather than being recreated from a text font — it is drawn heavier and more
 * tightly spaced than any weight of Inter, and typing it would be a redrawing
 * that drifts. Soft Minimal did type it, in Bungee, with a tangerine full stop;
 * both are gone.
 *
 * `tone` is which surface it sits on, not which colour it is. The dark variant
 * is the one for dark surfaces — a `#FFF7F2` wordmark beside the orange symbol
 * — which is the opposite of how a `theme="dark"` prop usually reads, hence the
 * name.
 */
export type WordmarkProps = {
  /** The surface it is drawn on. Defaults to a light one. */
  readonly on?: 'light' | 'dark';
  /** Rendered height in design pixels; the width follows the artwork's ratio. */
  readonly height: number;
  readonly style?: StyleProp<ImageStyle>;
};

/** The artwork's own aspect ratio, 1327×360. */
const RATIO = 1327 / 360;

export function Wordmark({ on = 'light', height, style }: WordmarkProps) {
  return (
    <Image
      source={on === 'dark' ? logoDark : logoLight}
      // The wordmark is the product's name, so it is content rather than
      // decoration: a screen reader that skipped it would not say where it is.
      accessibilityRole="image"
      accessibilityLabel="Huddle"
      resizeMode="contain"
      style={[styles.wordmark, { height, width: height * RATIO }, style]}
    />
  );
}

const styles = StyleSheet.create({
  wordmark: { resizeMode: 'contain' },
});
