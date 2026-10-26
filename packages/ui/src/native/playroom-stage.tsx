import { playroomColors, playroomTv } from '@huddle/design-tokens';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';

import { PlayroomWordmark } from './playroom-text';

export type PlayroomTvStageProps = PropsWithChildren<{
  readonly wordmark?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}>;

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
    backgroundColor: playroomColors.canvas,
  },
  stage: {
    width: playroomTv.width,
    height: playroomTv.height,
    overflow: 'hidden',
    backgroundColor: playroomColors.canvas,
  },
  wordmark: {
    position: 'absolute',
    left: playroomTv.safeX,
    top: playroomTv.safeY,
    zIndex: 2,
  },
});
