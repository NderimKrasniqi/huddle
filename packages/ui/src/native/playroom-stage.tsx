import { playroomColors, playroomTv } from '@huddle/design-tokens';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';

import { PlayroomWordmark } from './playroom-text';

export type PlayroomTvStageProps = PropsWithChildren<{
  /** Show the wordmark in the top-left corner. Off for the splash, which centres it. */
  readonly wordmark?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}>;

/**
 * The Playroom TV stage: a 1920×1080 cream room scaled to fit the screen,
 * with content laid out in stage pixels inside the overscan-safe frame. It is
 * display-only and never takes focus.
 */
export function PlayroomTvStage({ children, wordmark = true, style, testID }: PlayroomTvStageProps) {
  const viewport = useWindowDimensions();
  const scale = stageScale(viewport.width, viewport.height);

  return (
    <View style={styles.viewport} testID={testID}>
      <View
        style={[styles.stage, { transform: [{ scale }] }, style]}
        pointerEvents="none"
        focusable={false}
      >
        <View style={[styles.glow, styles.glowBottomLeft]} />
        <View style={[styles.glow, styles.glowBottomRight]} />
        {wordmark ? (
          <PlayroomWordmark height={playroomTv.wordmarkHeight} style={styles.wordmark} testID="playroom-tv-wordmark" />
        ) : null}
        {children}
      </View>
    </View>
  );
}

function stageScale(width: number, height: number): number {
  const scale = Math.min(width / playroomTv.width, height / playroomTv.height);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: playroomColors.cream,
  },
  stage: {
    width: playroomTv.width,
    height: playroomTv.height,
    overflow: 'hidden',
    backgroundColor: playroomColors.cream,
  },
  // A faint warm vignette in the lower corners, drawn natively rather than
  // blurred: two very large, very soft circles.
  glow: {
    position: 'absolute',
    width: 900,
    height: 900,
    borderRadius: 450,
    backgroundColor: playroomColors.yellow,
    opacity: 0.07,
  },
  glowBottomLeft: { left: -520, bottom: -560 },
  glowBottomRight: { right: -520, bottom: -560 },
  wordmark: {
    position: 'absolute',
    left: playroomTv.safeX,
    top: playroomTv.safeY,
    zIndex: 2,
  },
});
