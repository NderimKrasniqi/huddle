import { brandColors, durationFor, radii, spacing } from '@huddle/design-tokens';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  View,
  type ViewStyle,
} from 'react-native';

import { HEARTBEAT_ARTWORK } from './artwork';

export type LoadingMarkProps = {
  readonly size?: number;
  readonly animate?: boolean;
  /** Override the system preference for deterministic previews/tests. */
  readonly reduceMotion?: boolean;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
};

export const LOADING_HEART_COLORS = [
  brandColors.coral,
  brandColors.butter,
  brandColors.sky,
  brandColors.mint,
] as const;

/** Start/end angles for one of four equally spaced hearts orbiting the mark. */
export function loadingHeartAngles(index: number): [string, string] {
  const start = index * 90;
  return [`${start}deg`, `${start + 360}deg`];
}

/** Four-heart loading mark with a static reduced-motion fallback. */
export function LoadingMark({
  size = 88,
  animate = true,
  reduceMotion: reduceMotionOverride,
  accessibilityLabel = 'Huddle loading',
  testID,
}: LoadingMarkProps) {
  const systemReduceMotion = useReducedMotion();
  const reduceMotion = reduceMotionOverride ?? systemReduceMotion;
  const [orbit] = useState(() => new Animated.Value(0));

  useEffect(() => {
    orbit.stopAnimation();
    // The preference starts unresolved. Keep the mark static until the system
    // explicitly says motion is allowed; an explicit prop remains immediate
    // and deterministic for previews and tests.
    if (!animate || reduceMotion !== false) {
      orbit.setValue(0);
      return;
    }

    const spin = Animated.loop(
      Animated.timing(orbit, {
        toValue: 1,
        duration: durationFor('celebration', false) * 2,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spin.start();
    return () => spin.stop();
  }, [animate, orbit, reduceMotion]);

  const dotSize = size * 0.085;
  const orbitRadius = size * 0.39;
  const frameSize = size + spacing.md;

  return (
    <View
      testID={testID}
      focusable={false}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[styles.frame, { width: frameSize, height: frameSize }]}
    >
      <Image
        source={HEARTBEAT_ARTWORK.brand.displayMark}
        resizeMode="contain"
        style={{ width: size * 0.62, height: size * 0.62 }}
        accessible={false}
      />
      {LOADING_HEART_COLORS.map((color, index) => (
        <Animated.View
          key={color}
          testID={testID ? `${testID}-heart-${index + 1}` : undefined}
          accessible={false}
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: dotSize,
            height: dotSize,
            left: (frameSize - dotSize) / 2,
            top: (frameSize - dotSize) / 2,
            borderRadius: dotSize / 2,
            backgroundColor: color,
            transform: [
              {
                rotate: orbit.interpolate({
                  inputRange: [0, 1],
                  outputRange: loadingHeartAngles(index),
                }),
              },
              { translateY: -orbitRadius },
            ],
          }}
        />
      ))}
    </View>
  );
}

function useReducedMotion() {
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setEnabled(value);
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setEnabled);
    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  return enabled;
}

const styles = {
  frame: {
    borderRadius: radii.round,
    alignItems: 'center',
    justifyContent: 'center',
  } satisfies ViewStyle,
} as const;
