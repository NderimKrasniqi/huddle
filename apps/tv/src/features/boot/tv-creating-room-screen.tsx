import { playroomEasing, playroomMotion, playroomTv } from '@huddle/design-tokens';
import {
  PLAYROOM_ARTWORK,
  PlayroomFloat,
  PlayroomText,
  PlayroomTvStage,
  PlayroomWordmark,
} from '@huddle/ui/native';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe, ReduceMotion } from 'react-native-reanimated';

import type { TvAnimatedBootPhase } from './boot-state';
import { tvBootAnimationCopy } from './boot-state';
import { TvRestoreIndicator } from './tv-restore-indicator';
import { resolveTvReducedMotion, useTvSystemReducedMotion } from '../../ui/reduced-motion';

type TvCreatingRoomScreenProps = {
  readonly phase: TvAnimatedBootPhase;
};

/** The splash settles in once, from slightly small and transparent. */
const SPLASH_ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: playroomMotion.entranceTravel }, { scale: 0.98 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Easing.bezier(...playroomEasing.out) },
})
  .duration(playroomMotion.entrance)
  .reduceMotion(ReduceMotion.System);

const COPY_ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: playroomMotion.entranceTravel }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.bezier(...playroomEasing.out) },
})
  .duration(playroomMotion.entrance)
  .delay(playroomMotion.entrance)
  .reduceMotion(ReduceMotion.System);

/** Display-only startup, room-opening, and reconnecting stage. */
export function TvCreatingRoomScreen({
  phase,
}: TvCreatingRoomScreenProps) {
  const reduceMotion = resolveTvReducedMotion(useTvSystemReducedMotion());
  const copy = tvBootAnimationCopy(phase);

  return (
    <View
      style={styles.viewport}
      pointerEvents="none"
      focusable={false}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${copy.title}. ${copy.subtitle}`}
      testID="tv-boot-animated"
    >
      <PlayroomTvStage wordmark={false} testID="tv-boot-stage">
        <PlayroomFloat prop="starPurple" width={96} height={96} style={{ left: 300, top: 200 }} reduceMotion={reduceMotion} />
        <PlayroomFloat prop="starYellow" width={120} height={120} style={{ left: 190, top: 330 }} reduceMotion={reduceMotion} delay={300} />
        <PlayroomFloat prop="ballOrange" width={90} height={90} style={{ right: 250, top: 190 }} reduceMotion={reduceMotion} delay={200} />
        <PlayroomFloat prop="ballPurple" width={60} height={60} style={{ right: 180, top: 460 }} reduceMotion={reduceMotion} delay={600} />
        <View style={styles.content} pointerEvents="none" focusable={false}>
          <Animated.View entering={reduceMotion ? undefined : SPLASH_ENTER}>
            <Image source={PLAYROOM_ARTWORK.brand.splash} style={styles.splash} resizeMode="contain" accessible={false} />
          </Animated.View>
          <PlayroomWordmark height={132} style={styles.wordmark} />
          <Animated.View entering={reduceMotion ? undefined : COPY_ENTER} style={styles.copy}>
            <PlayroomText color="ink" style={playroomTv.type.heading}>{copy.title}</PlayroomText>
            <PlayroomText color="muted" style={playroomTv.type.body}>{copy.subtitle}</PlayroomText>
            <TvRestoreIndicator stage="restoring" size={72} reduceMotion={reduceMotion} />
          </Animated.View>
        </View>
      </PlayroomTvStage>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
  },
  content: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: playroomTv.safeY,
  },
  splash: {
    width: 500,
    height: 500,
  },
  wordmark: {
    marginTop: 6,
  },
  copy: {
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
});
