import { type ReactNode, useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import symbol from '../../assets/logo/huddle-symbol-orange.png';
import { colors } from '../colors';
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
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const stagger = motionDuration.activityCycle / 9;
    const movement = motionDuration.activityCycle / 3;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(position * stagger),
        Animated.timing(pulse, {
          toValue: 1,
          duration: movement / 2,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: movement / 2,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay((2 - position) * stagger + movement),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [position, pulse]);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: radius.pill,
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
        transform: [
          { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.18] }) },
        ],
      }}
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
  const [entry] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.timing(entry, {
      toValue: 1,
      duration: motionDuration.screenTransition,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start();
    return () => animation.stop();
  }, [entry]);

  return (
    <Animated.View
      style={[
        styles.screen,
        style,
        {
          opacity: entry,
          transform: [
            {
              scale: entry.interpolate({
                inputRange: [0, 1],
                outputRange: [loadingMotion.screenFromScale, 1],
              }),
            },
          ],
        },
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
 * Animated, so it works on Android TV without a second animation runtime.
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
  const [pulse] = useState(() => new Animated.Value(active ? 0 : 1));
  const tv = platform === 'tv';
  const symbolSize = tv ? 112 : 76;

  useEffect(() => {
    pulse.stopAnimation();

    if (!active) {
      pulse.setValue(1);
      return undefined;
    }

    pulse.setValue(0);
    const half = motionDuration.loadingPulse / 2;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: half,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: half,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [active, pulse]);

  return (
    <View style={[styles.loadingSurface, tv ? styles.loadingSurfaceTv : styles.loadingSurfacePhone]}>
      <Animated.View
        style={{
          opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [loadingMotion.markFromOpacity, 1],
          }),
          transform: [
            {
              scale: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [loadingMotion.markFromScale, loadingMotion.markToScale],
              }),
            },
          ],
        }}
      >
        <Image
          source={symbol}
          accessibilityElementsHidden
          resizeMode="contain"
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

const styles = StyleSheet.create({
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
