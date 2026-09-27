import type { AvatarId } from '@huddle/contracts';
import {
  playroomAvatarCircles,
  playroomAwayCircle,
  playroomColors,
} from '@huddle/design-tokens';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PLAYROOM_ARTWORK, PLAYROOM_AVATARS } from './playroom-artwork';

export type PlayroomAvatarProps = {
  readonly avatarId: AvatarId;
  /** Circle diameter. */
  readonly size: number;
  /** Orange crown badge. */
  readonly host?: boolean;
  /** Green check badge. */
  readonly ready?: boolean;
  /** Three dots: this player has not readied up yet. */
  readonly waiting?: boolean;
  /** Grey circle and faded portrait. */
  readonly away?: boolean;
  /** Screen-reader label; omit when a visible name sits beside the avatar. */
  readonly accessibilityLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
};

/**
 * A player's portrait on its pastel circle. The portrait is drawn slightly
 * larger than the circle and anchored to its bottom, so shoulders run to the
 * edge as in the concept boards.
 */
export function PlayroomAvatar({
  avatarId,
  size,
  host = false,
  ready = false,
  waiting = false,
  away = false,
  accessibilityLabel,
  style,
  testID,
}: PlayroomAvatarProps) {
  const badge = size * 0.36;
  const border = Math.max(2, size * 0.035);
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
        <Image
          source={PLAYROOM_AVATARS[avatarId]}
          style={[
            styles.portrait,
            { width: size * 1.14, height: size * 1.14, left: -size * 0.07, bottom: -size * 0.1 },
            away ? styles.away : null,
          ]}
          resizeMode="contain"
          accessible={false}
        />
      </View>
      {host ? (
        <View style={[styles.badge, badgeBox(badge, border), { backgroundColor: playroomColors.orange }]}>
          <Image source={PLAYROOM_ARTWORK.props.crown} style={{ width: badge * 0.66, height: badge * 0.55 }} resizeMode="contain" accessible={false} />
        </View>
      ) : null}
      {ready ? (
        <View style={[styles.badge, badgeBox(badge, border), { backgroundColor: playroomColors.green }]}>
          <View
            style={{
              width: badge * 0.26,
              height: badge * 0.46,
              marginTop: -badge * 0.08,
              borderColor: playroomColors.card,
              borderRightWidth: badge * 0.11,
              borderBottomWidth: badge * 0.11,
              transform: [{ rotate: '45deg' }],
            }}
          />
        </View>
      ) : null}
      {waiting && !ready ? (
        <View
          style={[
            styles.waiting,
            { width: size * 0.46, height: size * 0.22, borderRadius: size * 0.11, gap: size * 0.035, right: -size * 0.12 },
          ]}
        >
          {[0, 1, 2].map((dot) => (
            <View key={dot} style={[styles.dot, { width: size * 0.07, height: size * 0.07, borderRadius: size }]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function badgeBox(size: number, border: number): ViewStyle {
  return { width: size, height: size, borderRadius: size / 2, borderWidth: border, right: -size * 0.12, bottom: -size * 0.04 };
}

const styles = StyleSheet.create({
  circle: {
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
    borderColor: playroomColors.card,
  },
  waiting: {
    position: 'absolute',
    top: -4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: playroomColors.card,
    shadowColor: playroomColors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dot: {
    backgroundColor: playroomColors.muted,
  },
});
