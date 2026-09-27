import { durationFor, radii, semanticColors, spacing } from '@huddle/design-tokens';
import {
  HEARTBEAT_ARTWORK,
  HuddleText,
  LoadingMark,
  PlatformStage,
} from '@huddle/ui/native';
import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';

import type { TvAnimatedBootPhase } from './boot-state';
import { tvBootAnimationCopy } from './boot-state';
import { resolveTvReducedMotion, useTvSystemReducedMotion } from '../../ui/reduced-motion';

const OVERSCAN_X = 96;
const OVERSCAN_Y = 54;

type TvCreatingRoomScreenProps = {
  readonly phase: TvAnimatedBootPhase;
  readonly backgroundSource?: ImageSourcePropType;
  /** Override the system preference for deterministic previews and tests. */
  readonly reduceMotion?: boolean;
};

/** Display-only Heartbeat startup/opening/reconnecting stage. */
export function TvCreatingRoomScreen({
  phase,
  backgroundSource = HEARTBEAT_ARTWORK.tv.platformLivingRoom,
  reduceMotion: reduceMotionOverride,
}: TvCreatingRoomScreenProps) {
  const systemReduceMotion = useTvSystemReducedMotion();
  const reduceMotion = resolveTvReducedMotion(reduceMotionOverride, systemReduceMotion);
  const copy = tvBootAnimationCopy(phase);
  const [enter] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  const [ambient] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));

  useEffect(() => {
    enter.stopAnimation();
    ambient.stopAnimation();
    if (reduceMotion) {
      enter.setValue(1);
      ambient.setValue(1);
      return;
    }

    enter.setValue(0);
    ambient.setValue(0);
    const animation = Animated.parallel([
      Animated.timing(enter, {
        toValue: 1,
        duration: durationFor('slow', false),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ambient, {
        toValue: 1,
        duration: durationFor('celebration', false),
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [ambient, enter, phase, reduceMotion]);

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
      <PlatformStage
        backgroundSource={backgroundSource}
        backgroundTestID="tv-boot-background"
        shadeOpacity={0.3}
        testID="tv-boot-stage"
        pointerEvents="none"
        focusable={false}
        accessible={false}
      >
        <Animated.View
          style={[styles.ambientGlow, { opacity: ambient }]}
          pointerEvents="none"
          focusable={false}
        />
        <Animated.View
          style={[
            styles.content,
            {
              opacity: enter,
              transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
            },
          ]}
          pointerEvents="none"
          focusable={false}
          accessible={false}
        >
          <LoadingMark
            size={142}
            reduceMotion={reduceMotion}
            accessibilityLabel="Huddle loading"
            testID="tv-boot-loading-mark"
          />
          <HuddleText variant="tvDisplay" color="surface" align="center" style={styles.title}>
            {copy.title}
          </HuddleText>
          <HuddleText variant="bodyLarge" color="surface" align="center" style={styles.subtitle}>
            {copy.subtitle}
          </HuddleText>
        </Animated.View>
      </PlatformStage>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: semanticColors.text,
  },
  ambientGlow: {
    position: 'absolute',
    left: -140,
    top: -140,
    width: 760,
    height: 760,
    borderRadius: radii.round,
    backgroundColor: semanticColors.primary,
    opacity: 0.16,
  },
  content: {
    position: 'absolute',
    left: OVERSCAN_X,
    right: OVERSCAN_X,
    top: 154,
    bottom: OVERSCAN_Y,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 48,
  },
  title: {
    marginTop: spacing.xl,
    color: semanticColors.surface,
  },
  subtitle: {
    marginTop: spacing.sm,
    color: semanticColors.surface,
    opacity: 0.86,
  },
});
