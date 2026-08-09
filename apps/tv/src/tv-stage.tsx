import { colors, tvDesignSize, tvStageScale } from '@huddle/ui';
import background from '@huddle/ui/assets/tv-backgrounds/huddle-tv-background-01.png';
import { type ReactNode } from 'react';
import { ImageBackground, StyleSheet, useWindowDimensions, View } from 'react-native';

/**
 * The fixed 1280×720 surface every TV screen is drawn on, scaled to fill
 * whatever television it lands on (see `tvStageScale`). Screens inside it are
 * written in the handoff's own numbers — a 148×176 code tile is 148×176 here —
 * and one transform makes them right on a 720p panel, a 1080p panel, and the
 * simulator alike.
 *
 * The background image is the canvas rather than decoration laid over one: the
 * handoff is explicit that `tv-backgrounds/` *is* what a TV screen is drawn on,
 * so nothing paints a flat colour behind it. It sits inside the stage so it
 * scales with everything else, which is what keeps the plants at the edges of
 * the picture on a 720p panel and a 4K one alike.
 *
 * The letterbox bars stay a solid warm off-white. They are what a non-16:9
 * window leaves over, and the artwork is a 16:9 composition — stretching it out
 * there would draw a second pair of plants beside the first.
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
        style={[styles.stage, { transform: [{ scale: tvStageScale(window) }] }]}
      >
        {children}
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  // The bars a non-16:9 window leaves are screen-colored, so a letterboxed TV
  // reads as one surface rather than a picture pasted onto a black backing.
  // This is also the only place `colors.screen` is painted: everywhere else the
  // background image is the canvas.
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
