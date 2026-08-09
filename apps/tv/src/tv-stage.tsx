import { colors, tvDesignSize, tvSafeStageScale } from '@huddle/ui';
import background from '@huddle/ui/assets/tv-backgrounds/huddle-tv-background-01.png';
import { type ReactNode } from 'react';
import { ImageBackground, StyleSheet, useWindowDimensions, View } from 'react-native';

/**
 * The fixed 1280×720 surface every TV screen is drawn on, scaled to fill
 * whatever television it lands on (see `tvSafeStageScale`). Screens inside it are
 * written in the handoff's own numbers — a 148×176 code tile is 148×176 here —
 * and one transform makes them right on a 720p panel, a 1080p panel, and the
 * simulator alike.
 *
 * That transform scales into the title-safe rectangle, not the whole window: a
 * television crops the outer ~5% of every edge without reporting it (overscan),
 * so a stage drawn edge to edge loses its header and footer under the bezel on
 * real hardware while looking perfect in the simulator. `tvSafeStageScale` pulls
 * the whole composition into the inner 90%, and the margin it leaves is what the
 * TV crops instead of the content.
 *
 * The background image is the canvas rather than decoration laid over one: the
 * handoff is explicit that `tv-backgrounds/` *is* what a TV screen is drawn on,
 * so nothing paints a flat colour behind it. It sits inside the stage so it
 * scales with everything else, which is what keeps the plants at the edges of
 * the picture on a 720p panel and a 4K one alike — and, since the title-safe
 * inset scales the stage rather than cropping it, the artwork is inset with the
 * content and its edges stay where the composition puts them.
 *
 * The letterbox bars stay a solid warm off-white, and so does the title-safe
 * margin. Both are what the artwork does not cover, and it is a 16:9
 * composition — stretching it out there would draw a second pair of plants
 * beside the first.
 *
 * Nothing is drawn over the screen here. The About Panel used to be, and it was
 * the one thing on this television a remote could reach; the approved design
 * does not draw it, so it is gone and the Stage now holds only the screen it is
 * handed. Eyes up is total — see `huddle/tv-remote-surface`, which no longer
 * exempts anybody.
 */
export function TvStage({ children }: { readonly children: ReactNode }) {
  const window = useWindowDimensions();

  return (
    <View style={styles.letterbox}>
      <ImageBackground
        source={background}
        // The artwork's own ratio is the stage's, so it lands exactly; `cover`
        // is what keeps that true if either number is ever nudged.
        resizeMode="cover"
        style={[styles.stage, { transform: [{ scale: tvSafeStageScale(window) }] }]}
      >
        {children}
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  // What a non-16:9 window and the title-safe inset leave over, in the screen
  // colour, so a letterboxed TV reads as one surface rather than a picture
  // pasted onto a black backing. This is also the only place `colors.screen` is
  // painted: everywhere else the background image is the canvas.
  letterbox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.screen,
  },
  stage: {
    width: tvDesignSize.width,
    height: tvDesignSize.height,
  },
});
