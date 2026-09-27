import type { GameSettingIcon } from '@huddle/contracts';
import { playroomColors, playroomFonts, playroomMotion } from '@huddle/design-tokens';
import { useEffect, type ReactNode } from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {
  PLAYROOM_ARTWORK,
  PLAYROOM_SETTING_ICONS,
  type PlayroomProp,
  type PlayroomStatusArt,
} from './playroom-artwork';
import { PlayroomText } from './playroom-text';

export type PlayroomPillProps = {
  readonly children: ReactNode;
  /** `strong` is the deeper lavender used for a selected or emphasised pill. */
  readonly tone?: 'lavender' | 'strong' | 'soon';
  readonly textStyle?: StyleProp<TextStyle>;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
};

/** Lavender pill for chips, counts, and status lines. */
export function PlayroomPill({ children, tone = 'lavender', textStyle, style, testID }: PlayroomPillProps) {
  const backgroundColor = tone === 'strong'
    ? playroomColors.lavenderStrong
    : tone === 'soon'
      ? playroomColors.soonGrey
      : playroomColors.lavender;
  return (
    <View style={[styles.pill, { backgroundColor }, style]} testID={testID}>
      <PlayroomText color={tone === 'soon' ? 'soonText' : 'ink'} style={[styles.pillText, textStyle]}>
        {children}
      </PlayroomText>
    </View>
  );
}

export type PlayroomSettingIconProps = {
  readonly icon: GameSettingIcon | undefined;
  readonly size: number;
  readonly style?: StyleProp<ImageStyle>;
};

/** The picture a game declared for a setting; a question mark when it declared none. */
export function PlayroomSettingIcon({ icon, size, style }: PlayroomSettingIconProps) {
  return (
    <Image
      source={PLAYROOM_SETTING_ICONS[icon ?? 'count']}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessible={false}
    />
  );
}

export type PlayroomStatusImageProps = {
  readonly art: PlayroomStatusArt;
  readonly width: number;
  readonly height: number;
  readonly style?: StyleProp<ImageStyle>;
};

/** One of the status illustrations: waiting, paused, disconnected, and so on. */
export function PlayroomStatusImage({ art, width, height, style }: PlayroomStatusImageProps) {
  return (
    <Image
      source={PLAYROOM_ARTWORK.status[art]}
      style={[{ width, height }, style]}
      resizeMode="contain"
      accessible={false}
    />
  );
}

export type PlayroomFloatProps = {
  readonly prop: PlayroomProp;
  readonly width: number;
  readonly height: number;
  /** Absolute placement inside the parent. */
  readonly style?: StyleProp<ViewStyle>;
  /** Forces motion off (previews, tests); the system setting also applies. */
  readonly reduceMotion?: boolean;
  /**
   * Whether this prop keeps drifting after the entrance. Keep this to three
   * or four props per screen: constant motion on a screen left open for
   * minutes becomes noise.
   */
  readonly drifts?: boolean;
  /** Bob length in ms while the surface is new. */
  readonly duration?: number;
  readonly delay?: number;
  readonly tilt?: number;
};

/**
 * A decorative clay prop. It bobs while its surface is new, then either holds
 * still or drifts very slowly. Display-only, hidden from assistive technology,
 * and still under reduced motion.
 */
export function PlayroomFloat({
  prop,
  width,
  height,
  style,
  reduceMotion = false,
  drifts = false,
  duration = 6000,
  delay = 0,
  tilt = 6,
}: PlayroomFloatProps) {
  const systemReduceMotion = useReducedMotion();
  const still = reduceMotion || systemReduceMotion;
  const phase = useSharedValue(0);

  useEffect(() => {
    if (still) {
      cancelAnimation(phase);
      phase.set(0);
      return undefined;
    }
    const ease = Easing.inOut(Easing.sin);
    const bob = (length: number) => withSequence(
      withTiming(1, { duration: length / 2, easing: ease }),
      withTiming(0, { duration: length / 2, easing: ease }),
    );
    const bobs = Math.max(1, Math.round(playroomMotion.settle / duration));
    const settle = withRepeat(bob(duration), bobs, false);
    phase.set(
      drifts
        ? withSequence(withTiming(0, { duration: delay }), settle, withRepeat(bob(playroomMotion.drift), -1, false))
        : withSequence(withTiming(0, { duration: delay }), settle),
    );
    return () => cancelAnimation(phase);
  }, [delay, drifts, duration, phase, still]);

  const motion = useAnimatedStyle(() => ({
    transform: [
      { translateY: -height * 0.06 * phase.get() },
      { rotate: `${tilt * phase.get()}deg` },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.float, style, motion]}
    >
      <Image source={PLAYROOM_ARTWORK.props[prop]} style={{ width, height }} resizeMode="contain" accessible={false} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  pillText: {
    fontFamily: playroomFonts.extraBold,
    textAlign: 'center',
  },
  float: {
    position: 'absolute',
  },
});
