import { Image } from 'expo-image';
import { type ReactNode, useEffect } from 'react';
import {
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import symbol from '../../assets/logo/huddle-symbol-orange.png';
import { colors } from '../colors';
import { semanticStyles } from '@huddle/design-tokens';
import { loadingMotion, motionDuration } from '../motion';
import { radius } from '../shape';
import { fontFamily } from '../typography';
import { Wordmark } from './wordmark';

export type LoadingIndicatorSize = 'small' | 'regular' | 'tv';

const indicatorSize: Readonly<Record<LoadingIndicatorSize, number>> = {
  small: 5,
  regular: 8,
  tv: 12,
};

/** Three pulsing dots for an action whose authoritative answer is still pending. */
export function LoadingIndicator({
  size = 'regular',
  color = colors.accent,
  label = 'Loading',
}: {
  readonly size?: LoadingIndicatorSize;
  readonly color?: string;
  readonly label?: string;
}) {
  const dot = indicatorSize[size];

  return (
    <View
      style={styles.indicator}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      {[0, 1, 2].map((position) => (
        <LoadingDot key={position} position={position} size={dot} color={color} />
      ))}
    </View>
  );
}

function LoadingDot({
  position,
  size,
  color,
}: {
  readonly position: number;
  readonly size: number;
  readonly color: string;
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    const stagger = motionDuration.activityCycle / 9;
    const movement = motionDuration.activityCycle / 3;
    pulse.value = withRepeat(
      withSequence(
        withDelay(position * stagger, withTiming(1, {
          duration: movement / 2,
          easing: Easing.out(Easing.quad),
        })),
        withTiming(0, { duration: movement / 2, easing: Easing.in(Easing.quad) }),
        withDelay((2 - position) * stagger + movement, withTiming(0, { duration: 0 })),
      ),
      -1,
    );
    return () => cancelAnimation(pulse);
  }, [position, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.35, 1]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.82, 1.18]) }],
  }));

  return (
    <Animated.View
      style={[{
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: radius.pill,
      }, animatedStyle]}
    />
  );
}

/** A subtle fade and scale for transitions between platform-owned screens. */
export function AnimatedScreen({
  children,
  style,
}: {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const entry = useSharedValue(0);

  useEffect(() => {
    entry.value = withTiming(1, {
      duration: motionDuration.screenTransition,
      easing: Easing.out(Easing.cubic),
    });
    return () => cancelAnimation(entry);
  }, [entry]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: entry.value,
    transform: [
      { scale: interpolate(entry.value, [0, 1], [loadingMotion.screenFromScale, 1]) },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.screen,
        style,
        animatedStyle,
      ]}
    >
      {children}
    </Animated.View>
  );
}

export type HuddleLoadingPlatform = 'phone' | 'tv';

/**
 * The branded in-app bridge between the native splash and a usable Huddle
 * surface. It uses the existing wordmark/symbol assets and React Native
 * Reanimated and Worklets keep the transitions off the JavaScript render path.
 */
export function HuddleLoadingSurface({
  platform,
  title,
  message,
  active = true,
}: {
  readonly platform: HuddleLoadingPlatform;
  readonly title: string;
  readonly message: string;
  readonly active?: boolean;
}) {
  const pulse = useSharedValue(active ? 0 : 1);
  const tv = platform === 'tv';
  const symbolSize = tv ? 112 : 76;

  useEffect(() => {
    cancelAnimation(pulse);

    if (!active) {
      pulse.value = 1;
      return undefined;
    }

    pulse.value = 0;
    const half = motionDuration.loadingPulse / 2;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: half, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: half, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
    return () => cancelAnimation(pulse);
  }, [active, pulse]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [loadingMotion.markFromOpacity, 1]),
    transform: [
      {
        scale: interpolate(
          pulse.value,
          [0, 1],
          [loadingMotion.markFromScale, loadingMotion.markToScale],
        ),
      },
    ],
  }));

  return (
    <View style={[styles.loadingSurface, tv ? styles.loadingSurfaceTv : styles.loadingSurfacePhone]}>
      <Animated.View
        style={markStyle}
      >
        <Image
          source={symbol}
          accessibilityElementsHidden
          contentFit="contain"
          style={{ width: symbolSize, height: symbolSize }}
        />
      </Animated.View>

      <Wordmark height={tv ? 42 : 26} />
      <Text style={[styles.loadingTitle, tv ? styles.loadingTitleTv : styles.loadingTitlePhone]}>
        {title}
      </Text>
      <Text
        style={[styles.loadingMessage, tv ? styles.loadingMessageTv : styles.loadingMessagePhone]}
      >
        {message}
      </Text>
      {active ? (
        <LoadingIndicator
          size={tv ? 'tv' : 'regular'}
          label={title}
        />
      ) : (
        <View style={[styles.stoppedIndicator, tv && styles.stoppedIndicatorTv]} />
      )}
    </View>
  );
}

const styles = semanticStyles({
  screen: {
    flex: 1,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 18,
  },
  loadingSurface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingSurfacePhone: {
    gap: 16,
    paddingHorizontal: 32,
    backgroundColor: colors.canvas,
  },
  loadingSurfaceTv: {
    gap: 22,
    paddingHorizontal: 120,
  },
  loadingTitle: {
    color: colors.ink,
    fontFamily: fontFamily.bold,
    textAlign: 'center',
  },
  loadingTitlePhone: {
    fontSize: 28,
    lineHeight: 34,
  },
  loadingTitleTv: {
    fontSize: 48,
    lineHeight: 58,
  },
  loadingMessage: {
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    textAlign: 'center',
  },
  loadingMessagePhone: {
    maxWidth: 320,
    fontSize: 16,
    lineHeight: 24,
  },
  loadingMessageTv: {
    maxWidth: 760,
    fontSize: 22,
    lineHeight: 30,
  },
  stoppedIndicator: {
    width: 10,
    height: 10,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },
  stoppedIndicatorTv: {
    width: 14,
    height: 14,
  },
});
