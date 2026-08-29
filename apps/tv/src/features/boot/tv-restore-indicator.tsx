import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';

export type TvRestoreIndicatorStage = 'restoring' | 'reconnecting' | 'ready';

export type TvRestoreIndicatorProps = {
  readonly stage: TvRestoreIndicatorStage;
  readonly size?: number;
  /** Called once the ready check's spring has finished. */
  readonly onReadyAnimationComplete?: () => void;
};

const COLORS = {
  coral: '#FF5B54',
  orange: '#FFAA21',
  blue: '#45A2F4',
  purple: '#8C6DEB',
  green: '#38A169',
  cream: '#FFF8EC',
} as const;

/** Nominal test window; production handoff waits for the spring callback. */
export const TV_RESTORE_CHECK_DURATION_MS = 320;

/** Display-only restoring spinner that resolves into a green check. */
export function TvRestoreIndicator({
  stage,
  size = 82,
  onReadyAnimationComplete,
}: TvRestoreIndicatorProps) {
  const [transition] = React.useState(
    () => new Animated.Value(stage === 'ready' ? 1 : 0),
  );
  const [rotation] = React.useState(() => new Animated.Value(0));
  const readyCallback = useRef(onReadyAnimationComplete);
  const notified = useRef(false);

  useEffect(() => {
    if (stage !== 'ready') notified.current = false;

    readyCallback.current = onReadyAnimationComplete;
  }, [onReadyAnimationComplete, stage]);

  useEffect(() => {
    const transitionAnimation = Animated.spring(transition, {
      toValue: stage === 'ready' ? 1 : 0,
      useNativeDriver: true,
      damping: 15,
      stiffness: 180,
      mass: 0.8,
    });
    const spinnerAnimation =
      stage !== 'ready'
        ? Animated.loop(
            Animated.timing(rotation, {
              toValue: 1,
              duration: 1200,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
          )
        : undefined;

    transitionAnimation.start(({ finished }) => {
      if (finished && stage === 'ready' && !notified.current) {
        notified.current = true;
        readyCallback.current?.();
      }
    });
    spinnerAnimation?.start();

    return () => {
      transitionAnimation.stop();
      spinnerAnimation?.stop();
    };
  }, [rotation, stage, transition]);

  const checkScale = transition.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.3, 1.12, 1],
  });
  const spinnerOpacity = transition.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const checkOpacity = transition;
  const dotSize = size * 0.1;
  const center = size / 2;
  const radius = size * 0.31;
  const colors = [COLORS.coral, COLORS.orange, COLORS.purple, COLORS.blue];

  return (
    <View
      style={[styles.root, { width: size, height: size }]}
      pointerEvents="none"
      accessible={false}
      focusable={false}
      testID="tv-restore-indicator"
    >
      <Animated.View
        style={[
          styles.layer,
          {
            opacity: spinnerOpacity,
            transform: [
              {
                rotate: rotation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg'],
                }),
              },
            ],
          },
        ]}
        pointerEvents="none"
        accessibilityElementsHidden
        testID="tv-restore-indicator-spinner"
      >
        {Array.from({ length: 8 }).map((_, index) => {
          const angle = (index / 8) * Math.PI * 2;
          return (
            <View
              key={index}
              style={{
                position: 'absolute',
                width: dotSize,
                height: dotSize,
                left: center + Math.cos(angle) * radius - dotSize / 2,
                top: center + Math.sin(angle) * radius - dotSize / 2,
                borderRadius: dotSize / 2,
                backgroundColor: colors[index % colors.length],
                opacity: 0.48 + (index / 8) * 0.52,
              }}
            />
          );
        })}
      </Animated.View>

      <Animated.View
        style={[
          styles.layer,
          {
            opacity: checkOpacity,
            transform: [{ scale: checkScale }],
          },
        ]}
        pointerEvents="none"
        accessibilityElementsHidden
        testID="tv-restore-indicator-check"
      >
        <View
          style={[
            styles.checkCircle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
        >
          <View
            style={[
              styles.checkLeft,
              {
                width: size * 0.12,
                height: size * 0.055,
                left: size * 0.145,
                top: size * 0.285,
                transform: [{ rotate: '42deg' }],
              },
            ]}
          />
          <View
            style={[
              styles.checkRight,
              {
                width: size * 0.25,
                height: size * 0.055,
                left: size * 0.225,
                top: size * 0.245,
                transform: [{ rotate: '-48deg' }],
              },
            ]}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
  },
  layer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkLeft: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: COLORS.cream,
  },
  checkRight: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: COLORS.cream,
  },
});
