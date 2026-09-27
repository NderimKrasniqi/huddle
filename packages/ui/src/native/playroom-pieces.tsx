import type { GameSettingIcon } from '@huddle/contracts';
import { playroomColors, playroomFonts } from '@huddle/design-tokens';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

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
  readonly reduceMotion: boolean;
  /** Loop length in ms; props at different speeds read as a room, not a pattern. */
  readonly duration?: number;
  readonly delay?: number;
  readonly tilt?: number;
};

/**
 * A decorative clay prop that bobs gently. Display-only and hidden from
 * assistive technology; with reduced motion it simply holds still.
 */
export function PlayroomFloat({
  prop,
  width,
  height,
  style,
  reduceMotion,
  duration = 6000,
  delay = 0,
  tilt = 6,
}: PlayroomFloatProps) {
  const [phase] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduceMotion) {
      phase.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(phase, { toValue: 1, duration: duration / 2, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(phase, { toValue: 0, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, duration, phase, reduceMotion]);

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.float,
        style,
        {
          transform: [
            { translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [0, -height * 0.06] }) },
            { rotate: phase.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${tilt}deg`] }) },
          ],
        },
      ]}
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
