import type { GameSettingIcon } from '@huddle/contracts';
import { playroomColors, playroomEasing, playroomFonts, playroomMotion } from '@huddle/design-tokens';
import type { ReactNode } from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import Animated, { Easing, Keyframe, ReduceMotion, useReducedMotion } from 'react-native-reanimated';

import {
  PLAYROOM_ARTWORK,
  PLAYROOM_SETTING_ICONS,
  type PlayroomProp,
  type PlayroomStatusArt,
} from './playroom-artwork';
import { PlayroomText } from './playroom-text';

export type PlayroomPillProps = {
  readonly children: ReactNode;
  /** A small icon before the label; status pills always carry one. */
  readonly icon?: ReactNode;
  readonly tone?: 'lavender' | 'surface' | 'disabled' | 'success';
  readonly textStyle?: StyleProp<TextStyle>;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
};

/** Pill for chips, counts, and status lines: `8 / 10 ready`, `Host`. */
export function PlayroomPill({ children, icon, tone = 'lavender', textStyle, style, testID }: PlayroomPillProps) {
  const { backgroundColor, color } = PILL_TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor }, style]} testID={testID}>
      {icon}
      <PlayroomText color={color} style={[styles.pillText, textStyle]}>
        {children}
      </PlayroomText>
    </View>
  );
}

const PILL_TONES = {
  lavender: { backgroundColor: playroomColors.lavender, color: 'ink' as const },
  surface: { backgroundColor: playroomColors.surface, color: 'ink' as const },
  disabled: { backgroundColor: playroomColors.disabled, color: 'muted' as const },
  success: { backgroundColor: playroomColors.successSurface, color: 'success' as const },
};

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
  /** Entrance delay, to let props arrive one after another. */
  readonly delay?: number;
};

/**
 * A decorative clay prop. It settles into place once when its surface
 * appears and then holds still: nothing bobs forever behind the room's
 * information. Hidden from assistive technology.
 */
export function PlayroomFloat({ prop, width, height, style, reduceMotion = false, delay = 0 }: PlayroomFloatProps) {
  const systemReduceMotion = useReducedMotion();
  const still = reduceMotion || systemReduceMotion;
  return (
    <Animated.View
      entering={still ? undefined : propEntrance(delay)}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.float, style]}
    >
      <Image source={PLAYROOM_ARTWORK.props[prop]} style={{ width, height }} resizeMode="contain" accessible={false} />
    </Animated.View>
  );
}

function propEntrance(delay: number) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: playroomMotion.entranceTravel }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.bezier(...playroomEasing.out) },
  })
    .duration(playroomMotion.entrance)
    .delay(delay)
    .reduceMotion(ReduceMotion.System);
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  pillText: {
    fontFamily: playroomFonts.label,
    textAlign: 'center',
  },
  float: {
    position: 'absolute',
  },
});
