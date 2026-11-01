import type { AvatarId } from '@huddle/domain';
import { playroomColors, playroomEasing, playroomMotion, playroomRadii, playroomShadows, playroomTv } from '@huddle/design-tokens';
import { PlayroomAvatar, PlayroomText } from '@huddle/ui/native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

function seatArrival(delay: number) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.9 }] },
    100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.bezier(...playroomEasing.out) },
  })
    .duration(playroomMotion.entrance)
    .delay(delay)
    .reduceMotion(ReduceMotion.System);
}

const SEAT_DROP_IN = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -60 }, { scale: 0.9 }] },
  60: { opacity: 1, transform: [{ translateY: 6 }, { scale: 1.04 }], easing: Easing.bezier(...playroomEasing.out) },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Easing.bezier(...playroomEasing.inOut) },
})
  .duration(520)
  .reduceMotion(ReduceMotion.System);

export type RoomInvitationPlayer = {
  readonly id: string;
  readonly name: string;
  readonly avatarId?: AvatarId;
  readonly host?: boolean;
  readonly away?: boolean;
};

export type RoomInvitationArrival = {
  readonly id: string;
  readonly name: string;
  readonly avatarId: AvatarId;
};

export function JoinedPlayer({
  player,
  arrivalDelay,
  justArrived = false,
  reduceMotion,
}: {
  readonly player: RoomInvitationPlayer;
  readonly arrivalDelay: number;
  readonly justArrived?: boolean;
  readonly reduceMotion: boolean;
}) {
  const name = player.name.trim() || 'Player';
  return (
    <Animated.View
      entering={reduceMotion ? undefined : justArrived ? SEAT_DROP_IN : seatArrival(arrivalDelay)}
      style={styles.seat}
      pointerEvents="none"
      focusable={false}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Player ${name} joined${player.host ? ', host' : ''}${player.away ? ', away' : ''}`}
      testID="joined-player-slot"
    >
      {player.avatarId ? (
        <PlayroomAvatar avatarId={player.avatarId} size={100} host={player.host} away={player.away} testID="joined-player-avatar" />
      ) : (
        <View style={styles.initial} pointerEvents="none" focusable={false}>
          <PlayroomText style={playroomTv.type.hero} accessibilityElementsHidden>
            {Array.from(name)[0]?.toLocaleUpperCase() ?? '?'}
          </PlayroomText>
        </View>
      )}
      <PlayroomText numberOfLines={1} style={[playroomTv.type.caption, styles.name, justArrived ? styles.nameNew : null]} accessibilityElementsHidden>
        {name}
      </PlayroomText>
      {player.away ? <SeatTag label="Away" /> : null}
    </Animated.View>
  );
}

export function ArrivingSeat({ arrival, reduceMotion }: { readonly arrival: RoomInvitationArrival; readonly reduceMotion: boolean }) {
  const name = arrival.name.trim();
  const breath = useSharedValue(1);
  useEffect(() => {
    breath.value = reduceMotion ? 1 : withRepeat(withTiming(0.6, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [breath, reduceMotion]);
  const breathing = useAnimatedStyle(() => ({ opacity: breath.value }));

  return (
    <Animated.View
      entering={reduceMotion ? undefined : seatArrival(0)}
      style={styles.seat}
      pointerEvents="none"
      focusable={false}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${name || 'Someone'} is joining`}
      testID="arriving-player-slot"
    >
      <Animated.View style={[styles.arrivingRing, breathing]} pointerEvents="none" focusable={false}>
        <PlayroomAvatar avatarId={arrival.avatarId} size={88} testID="arriving-player-avatar" />
      </Animated.View>
      <PlayroomText color="muted" numberOfLines={1} style={[playroomTv.type.caption, styles.name]} accessibilityElementsHidden>
        {name || 'Joining…'}
      </PlayroomText>
      {name ? <SeatTag label="Joining" tone="joining" /> : null}
    </Animated.View>
  );
}

function SeatTag({ label, tone = 'away' }: { readonly label: string; readonly tone?: 'away' | 'joining' }) {
  return (
    <View style={[styles.tag, tone === 'joining' ? styles.tagJoining : styles.tagAway]} pointerEvents="none" focusable={false}>
      <PlayroomText color="ink" style={styles.tagText} accessibilityElementsHidden>
        {label}
      </PlayroomText>
    </View>
  );
}

export function EmptySlot({ position }: { readonly position: number }) {
  return (
    <View
      style={styles.seat}
      pointerEvents="none"
      focusable={false}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Empty player slot ${position + 1}`}
      testID="empty-player-slot"
    >
      <View style={styles.empty} pointerEvents="none" focusable={false}>
        <View style={styles.silhouetteHead} />
        <View style={styles.silhouetteBody} />
      </View>
      <View style={styles.nameSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  seat: {
    width: 152,
    alignItems: 'center',
  },
  initial: {
    width: 100,
    height: 100,
    borderRadius: 100 / 2,
    backgroundColor: playroomColors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrivingRing: {
    width: 100,
    height: 100,
    borderRadius: 100 / 2,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: playroomColors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    width: 100,
    height: 100,
    borderRadius: 100 / 2,
    backgroundColor: playroomColors.surface,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: playroomColors.border,
    alignItems: 'center',
    overflow: 'hidden',
  },
  silhouetteHead: {
    marginTop: 100 * 0.22,
    width: 100 * 0.3,
    height: 100 * 0.3,
    borderRadius: 100,
    backgroundColor: playroomColors.lavender,
  },
  silhouetteBody: {
    marginTop: 100 * 0.05,
    width: 100 * 0.56,
    height: 100 * 0.56,
    borderRadius: 100,
    backgroundColor: playroomColors.lavender,
  },
  nameNew: {
    paddingHorizontal: 12,
    borderRadius: playroomRadii.pill,
    overflow: 'hidden',
    backgroundColor: playroomColors.orange,
  },
  name: {
    marginTop: 6,
    maxWidth: 152,
  },
  nameSpacer: {
    marginTop: 6,
    height: playroomTv.type.caption.lineHeight,
  },
  tag: {
    position: 'absolute',
    top: -30,
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 1,
    backgroundColor: playroomColors.surface,
    borderWidth: 2,
    borderColor: playroomColors.border,
    ...playroomShadows.card,
  },
  tagAway: {
    borderColor: playroomColors.border,
  },
  tagJoining: {
    backgroundColor: playroomColors.orange,
    borderColor: playroomColors.orange,
  },
  tagText: {
    ...playroomTv.type.caption,
    fontFamily: playroomTv.type.title.fontFamily,
    letterSpacing: 0.5,
  },
});
