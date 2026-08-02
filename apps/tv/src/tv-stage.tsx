import { colors, tvDesignSize, tvStageScale } from '@huddle/ui';
import { type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AboutPanel } from './tv-about';

/**
 * The fixed 1280×720 surface every TV screen is drawn on, scaled to fill
 * whatever television it lands on (see `tvStageScale`). Screens inside it are
 * written in the handoff's own numbers — a 148×176 code tile is 148×176 here —
 * and one transform makes them right on a 720p panel, a 1080p panel, and the
 * simulator alike.
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
      <View style={[styles.stage, { transform: [{ scale: tvStageScale(window) }] }]}>
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
