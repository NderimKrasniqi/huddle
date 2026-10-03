import type { AvatarId } from '@huddle/contracts';
import {
  playroomAvatarCircles,
  playroomAwayCircle,
  playroomColors,
  playroomEasing,
  playroomMotion,
} from '@huddle/design-tokens';
import { Image, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, Keyframe, ReduceMotion } from 'react-native-reanimated';

import { PLAYROOM_ARTWORK, PLAYROOM_AVATARS } from './playroom-artwork';

/** Badges arrive from 0.9, never from nothing; reduced motion shows them at once. */
const BADGE_POP = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.9 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.bezier(...playroomEasing.out) },
})
  .duration(playroomMotion.transition)
  .reduceMotion(ReduceMotion.System);

/**
 * The portrait is drawn 1.3× the circle, shifted up and left, so the face
 * fills the circle and the shoulders reach its bottom edge.
 */
const PORTRAIT_SCALE = 1.3;
const PORTRAIT_LEFT = -0.15;
const PORTRAIT_TOP = -0.2;

export type PlayroomAvatarProps = {
  readonly avatarId: AvatarId;
  /** Circle diameter. */
  readonly size: number;
  /** Orange crown badge. */
  readonly host?: boolean;
  /** Green check badge. */
  readonly ready?: boolean;
  /** Orange raised-hand badge, for the ready check. */
  readonly handUp?: boolean;
  /** Grey circle and faded portrait. */
  readonly away?: boolean;
  /** Screen-reader label; omit when a visible name sits beside the avatar. */
  readonly accessibilityLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
};

/**
 * A player's portrait on its pastel circle. Below the circle's middle the
 * portrait is clipped to the circle; above it, hair and ears may break out of
 * the top, as in the concept boards. Leave room above the avatar for that.
 */
export function PlayroomAvatar({
  avatarId,
  size,
  host = false,
  ready = false,
  handUp = false,
  away = false,
  accessibilityLabel,
  style,
  testID,
}: PlayroomAvatarProps) {
  const badge = size * 0.36;
  const border = Math.max(2, size * 0.035);
  const source = PLAYROOM_AVATARS[avatarId];
  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: away ? playroomAwayCircle : playroomAvatarCircles[avatarId],
          },
        ]}
      >
        <Portrait source={source} size={size} top={PORTRAIT_TOP * size} away={away} />
      </View>
      {/* The top half again, unclipped, so it can break out of the circle. An
          away portrait is translucent and stays inside its circle. */}
      {away ? null : (
        <View
          style={[
            styles.breakout,
            { left: PORTRAIT_LEFT * size, top: PORTRAIT_TOP * size, width: PORTRAIT_SCALE * size, height: (0.5 - PORTRAIT_TOP) * size },
          ]}
          pointerEvents="none"
        >
          <Portrait source={source} size={size} top={0} left={0} away={false} />
        </View>
      )}
      {host ? (
        <Animated.View entering={BADGE_POP} style={[styles.badge, badgeBox(badge, border), { backgroundColor: playroomColors.orange }]}>
          <Image source={PLAYROOM_ARTWORK.props.crown} style={{ width: badge * 0.66, height: badge * 0.55 }} resizeMode="contain" accessible={false} />
        </Animated.View>
      ) : null}
      {ready ? (
        <Animated.View entering={BADGE_POP} style={[styles.badge, badgeBox(badge, border), { backgroundColor: playroomColors.success }]}>
          <View
            style={{
              width: badge * 0.26,
              height: badge * 0.46,
              marginTop: -badge * 0.08,
              borderColor: playroomColors.surface,
              borderRightWidth: badge * 0.11,
              borderBottomWidth: badge * 0.11,
              transform: [{ rotate: '45deg' }],
            }}
          />
        </Animated.View>
      ) : null}
      {handUp && !ready ? (
        <Animated.View
          entering={BADGE_POP}
          // Bottom-left, mirroring the crown: a badge on the head would cover a face.
          style={[styles.badge, badgeBox(badge, border), { right: undefined, left: -badge * 0.12, backgroundColor: playroomColors.orange }]}
        >
          <Image source={PLAYROOM_ARTWORK.props.hand} style={{ width: badge * 0.62, height: badge * 0.62 }} resizeMode="contain" accessible={false} />
        </Animated.View>
      ) : null}
    </View>
  );
}

type PortraitProps = {
  readonly source: ImageSourcePropType;
  readonly size: number;
  readonly top: number;
  readonly left?: number;
  readonly away: boolean;
};

function Portrait({ source, size, top, left = PORTRAIT_LEFT * size, away }: PortraitProps) {
  return (
    <Image
      source={source}
      style={[
        styles.portrait,
        { width: size * PORTRAIT_SCALE, height: size * PORTRAIT_SCALE, left, top },
        away ? styles.away : null,
      ]}
      resizeMode="contain"
      accessible={false}
    />
  );
}

function badgeBox(size: number, border: number): ViewStyle {
  return { width: size, height: size, borderRadius: size / 2, borderWidth: border, right: -size * 0.12, bottom: -size * 0.04 };
}

const styles = StyleSheet.create({
  circle: {
    overflow: 'hidden',
  },
  breakout: {
    position: 'absolute',
    overflow: 'hidden',
  },
  portrait: {
    position: 'absolute',
  },
  away: {
    opacity: 0.42,
  },
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: playroomColors.surface,
  },
});
