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
 * so it fills the whole viewport. The title-safe transform belongs only to the
 * content stage nested inside it. That keeps the plants at the screen edges
 * while the 1280×720 composition remains clear of overscan.
 *
 * The image uses `cover` at the viewport boundary, so a non-16:9 panel crops
 * the decorative artwork rather than introducing a second pair of plants in
 * letterbox bars. The content stage still fits and centres using the smaller
 * window ratio before the title-safe inset.
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
    <ImageBackground
      source={background}
      // The artwork reaches the screen edges at every panel size. `cover`
      // preserves its ratio while allowing a non-16:9 viewport to crop the
      // decorative edges instead of scaling the content with the image.
      resizeMode="cover"
      style={styles.background}
    >
      <View style={[styles.stage, { transform: [{ scale: tvSafeStageScale(window) }] }]}>
        {children}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  // The artwork is deliberately full-viewport. The warm fill prevents a flash
  // before the image has decoded and remains the fallback if the asset fails.
  background: {
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
