import { playroomColors, playroomTv } from '@huddle/design-tokens';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PlayroomWordmark } from './playroom-text';
import { useStageScale } from './stage-scale';

export type PlayroomTvStageProps = PropsWithChildren<{
  readonly wordmark?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}>;

export function PlayroomTvStage({ children, wordmark = true, style, testID }: PlayroomTvStageProps) {
  const scale = useStageScale();

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
