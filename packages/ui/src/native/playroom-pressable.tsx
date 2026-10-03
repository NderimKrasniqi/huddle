import { playroomEasing, playroomMotion } from '@huddle/design-tokens';
import type { GestureResponderEvent, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { Pressable } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PlayroomPressableProps = Omit<PressableProps, 'style'> & {
  readonly style?: StyleProp<ViewStyle>;
};

/**
 * A tappable surface with the Playroom press: the same subtle scale as
 * `PlayroomButton`, on press-in so the phone answers the finger at once,
 * and settling back on release. Rows, options, tiles and cards use it so
 * nothing tappable feels dead.
 */
export function PlayroomPressable({ style, disabled, onPressIn, onPressOut, ...props }: PlayroomPressableProps) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const pressTo = (value: number) => {
    scale.set(withTiming(value, { duration: playroomMotion.press, reduceMotion: ReduceMotion.System, easing: Easing.bezier(...playroomEasing.out) }));
  };

  return (
    <AnimatedPressable
      pressRetentionOffset={16}
      {...props}
      disabled={disabled}
      onPressIn={(event: GestureResponderEvent) => {
        if (!disabled) pressTo(playroomMotion.pressScale);
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        pressTo(1);
        onPressOut?.(event);
      }}
      style={[style, pressStyle]}
    />
  );
}
