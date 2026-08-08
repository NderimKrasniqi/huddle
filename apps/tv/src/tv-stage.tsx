import { colors, tvDesignSize, tvSafeStageScale } from '@huddle/ui';
import { type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AboutPanel } from './tv-about';

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
 * the whole composition into the inner 90%, and the screen-colored margin it
 * leaves is what the TV crops instead of the content.
 *
 * The About Panel is drawn here, over the screen and inside the scale, because
 * every TV screen there is comes through this component: pairing, the carousel,
 * a game, and the unknown-game screen. Mounting it once here is what makes "the
 * TV's one remote-reachable control" a fact about the app rather than a claim
 * four call sites have to keep true. It draws nothing until the remote asks for
 * it — see `tv-about.tsx`.
 */
export function TvStage({ children }: { readonly children: ReactNode }) {
  const window = useWindowDimensions();

  return (
    <View style={styles.letterbox}>
      <View style={[styles.stage, { transform: [{ scale: tvSafeStageScale(window) }] }]}>
        {children}
        <AboutPanel />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The bars a non-16:9 window leaves are screen-colored, so a letterboxed TV
  // reads as one surface rather than a picture pasted onto a black backing.
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
