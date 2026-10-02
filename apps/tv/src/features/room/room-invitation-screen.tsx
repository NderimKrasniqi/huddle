import { ROOM_PLAYER_CAP, type AvatarId } from '@huddle/domain';
import {
  playroomColors,
  playroomEasing,
  playroomMotion,
  playroomRadii,
  playroomShadows,
  playroomTv,
} from '@huddle/design-tokens';
import {
  PlayroomAvatar,
  PlayroomMoment,
  PlayroomPill,
  PlayroomText,
  PlayroomTvStage,
} from '@huddle/ui/native';
import QRCode from 'react-native-qrcode-svg';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe, ReduceMotion } from 'react-native-reanimated';

import { resolveTvReducedMotion, useTvSystemReducedMotion } from '../../ui/reduced-motion';

/** The room's seat count comes from the room rules, not from the avatar set. */
const PLAYER_CAPACITY = ROOM_PLAYER_CAP;

/** A seat's portrait arriving: from 0.9 and transparent, never from nothing. */
function seatArrival(delay: number) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.9 }] },
    100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.bezier(...playroomEasing.out) },
  })
    .duration(playroomMotion.entrance)
    .delay(delay)
    .reduceMotion(ReduceMotion.System);
}

/** The stable roster data needed by the display-only invitation renderer. */
export type RoomInvitationPlayer = {
  readonly id: string;
  readonly name: string;
  readonly avatarId?: AvatarId;
  readonly host?: boolean;
  readonly away?: boolean;
};

export type RoomInvitationScreenProps = {
  readonly welcomeIds?: readonly string[];
  readonly roomCode: string;
  readonly joinUrl: string;
  readonly players?: readonly RoomInvitationPlayer[];
  /** Overrides the system setting in previews and tests. */
  readonly reduceMotion?: boolean;
};

/**
 * The TV room: the join code as four tiles that match the phone's four input
 * boxes, the QR code beside them, the room's ten seats, and who is running
 * it. Display-only; phones do the joining.
 */
export function RoomInvitationScreen({
  roomCode,
  joinUrl,
  players = [],
  welcomeIds = [],
  reduceMotion: reduceMotionOverride,
}: RoomInvitationScreenProps) {
  const systemReduceMotion = useTvSystemReducedMotion();
  const reduceMotion = resolveTvReducedMotion(reduceMotionOverride, systemReduceMotion);
  const normalizedCode = roomCode.trim().toUpperCase().slice(0, 4);
  const spokenCode = normalizedCode.split('').join(' ');
  const visiblePlayers = players.slice(0, PLAYER_CAPACITY);
  const joined = visiblePlayers.length;
  const hostName = visiblePlayers.find((player) => player.host)?.name.trim();
  // Seats present when the room first appears cascade in; anyone joining
  // afterwards arrives on their own, without waiting on a stagger.
  const [firstShow, setFirstShow] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setFirstShow(false), PLAYER_CAPACITY * playroomMotion.stagger + playroomMotion.entrance);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.viewport} pointerEvents="none" focusable={false} accessible={false} testID="room-invitation-viewport">
      <PlayroomTvStage testID="room-invitation-stage">
        <View style={styles.column} pointerEvents="none" focusable={false}>
          <PlayroomText accessibilityRole="header" style={playroomTv.type.heading} testID="room-invitation-heading">
            {joined === 0 ? 'Good company. Great games.' : 'Make yourself at home.'}
          </PlayroomText>

          <PlayroomText color="muted" style={playroomTv.type.body}>Your phone is your controller. Join the room and let the good times begin.</PlayroomText>
          <View style={styles.joinRow} pointerEvents="none" focusable={false}>
            <View
              style={styles.codeBlock}
              accessible
              accessibilityRole="text"
              accessibilityLabel={`Room code ${spokenCode}`}
              focusable={false}
              testID="room-code"
            >
              <View style={styles.tiles} accessibilityElementsHidden>
                {Array.from(normalizedCode).map((letter, position) => (
                  <View key={position} style={styles.tile}>
                    <PlayroomText style={playroomTv.type.roomCode}>{letter}</PlayroomText>
                  </View>
                ))}
              </View>
              <PlayroomText color="muted" style={playroomTv.type.caption}>Type this code on your phone</PlayroomText>
            </View>
            <PlayroomText color="muted" style={playroomTv.type.caption} accessibilityElementsHidden>
              or
            </PlayroomText>
            <View
              style={styles.qrBlock}
              accessible
              accessibilityRole="image"
              accessibilityLabel={`QR code to join room ${spokenCode}`}
              focusable={false}
            >
              <View style={styles.qrCard}>
                <QRCode
                  value={joinUrl}
                  size={164}
                  color={playroomColors.ink}
                  backgroundColor={playroomColors.surface}
                  testID="room-join-qr"
                />
              </View>
              <PlayroomText color="muted" style={playroomTv.type.caption} accessibilityElementsHidden>
                Scan to join
              </PlayroomText>
            </View>
          </View>

          <PlayroomPill style={styles.status} textStyle={playroomTv.type.label} testID="room-roster-count">
            {joined >= PLAYER_CAPACITY ? `Room full · ${PLAYER_CAPACITY} / ${PLAYER_CAPACITY}` : `${joined} / ${PLAYER_CAPACITY} joined`}
          </PlayroomPill>

          <View style={styles.footer} pointerEvents="none" focusable={false}>
            
            <PlayroomText style={[playroomTv.type.label, styles.footerText]} testID="room-invitation-footer">
              {joined === 0
                ? 'The first phone to join becomes the host'
                : joined < 2
                  ? `${hostName || 'The host'} is the host · waiting for one more player`
                  : `${hostName || 'The host'} is choosing what’s next`}
            </PlayroomText>
            
          </View>
        </View>
        <View style={styles.roomSide}>
          <PlayroomMoment art="lounge" width={760} height={380} glow style={styles.scene} />
          <View style={styles.greeting}>
            {welcomeIds.length > 0 ? <View style={styles.welcome} accessible accessibilityLiveRegion="polite"
              accessibilityLabel={`${visiblePlayers.filter((player) => welcomeIds.includes(player.id)).map((player) => player.name).join(', ')} joined the room`} testID="tv-join-welcome">
              {visiblePlayers.filter((player) => welcomeIds.includes(player.id)).slice(0, 3).map((player) =>
                player.avatarId ? <PlayroomAvatar key={player.id} avatarId={player.avatarId} size={56} /> : null)}
              <PlayroomText style={playroomTv.type.label}>{welcomeIds.length === 1 ? `${visiblePlayers.find((player) => player.id === welcomeIds[0])?.name ?? 'Your friend'} is in!` : `${welcomeIds.length} new faces. Welcome in!`}</PlayroomText>
            </View> : <PlayroomText color="muted" style={playroomTv.type.caption}>There’s a seat for everyone.</PlayroomText>}
          </View>
          <View style={styles.grid} pointerEvents="none" focusable={false} testID="player-grid">
            {Array.from({ length: PLAYER_CAPACITY }, (_unused, position) => {
              const player = visiblePlayers[position];
              return player ? (
                <JoinedPlayer
                  key={player.id}
                  player={player}
                  arrivalDelay={firstShow ? position * playroomMotion.stagger : 0}
                  reduceMotion={reduceMotion}
                />
              ) : (
                <EmptySlot key={`empty-${position + 1}`} position={position} />
              );
            })}
          </View>

        </View>
      </PlayroomTvStage>
    </View>
  );
}

function JoinedPlayer({
  player,
  arrivalDelay,
  reduceMotion,
}: {
  readonly player: RoomInvitationPlayer;
  readonly arrivalDelay: number;
  readonly reduceMotion: boolean;
}) {
  const name = player.name.trim() || 'Player';
  return (
    <Animated.View
      entering={reduceMotion ? undefined : seatArrival(arrivalDelay)}
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
      <PlayroomText numberOfLines={1} style={[playroomTv.type.caption, styles.name]} accessibilityElementsHidden>
        {name}
      </PlayroomText>
      {player.away ? <SeatTag label="AWAY" /> : null}
    </Animated.View>
  );
}

function SeatTag({ label }: { readonly label: string }) {
  return (
    <View style={[styles.tag, styles.tagAway]} pointerEvents="none" focusable={false}>
      <PlayroomText color="ink" style={styles.tagText} accessibilityElementsHidden>
        {label}
      </PlayroomText>
    </View>
  );
}

function EmptySlot({ position }: { readonly position: number }) {
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
      {/* A quiet silhouette: no number, no label. */}
      <View style={styles.empty} pointerEvents="none" focusable={false}>
        <View style={styles.silhouetteHead} />
        <View style={styles.silhouetteBody} />
      </View>
      <View style={styles.nameSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    backgroundColor: playroomColors.canvas,
  },
  column: { position: 'absolute', left: playroomTv.safeX, top: 190, width: 720, gap: 26 },
  roomSide: { position: 'absolute', right: playroomTv.safeX, top: 156, width: 900, alignItems: 'center' },
  scene: { alignItems: 'center' },
  greeting: { height: 100, alignItems: 'center', justifyContent: 'center' },
  welcome: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 28, backgroundColor: playroomColors.successSurface },
  joinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  codeBlock: {
    alignItems: 'center',
    gap: 8,
  },
  tiles: {
    flexDirection: 'row',
    gap: 10,
  },
  tile: {
    width: 112,
    height: 132,
    borderRadius: playroomRadii.card,
    backgroundColor: playroomColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...playroomShadows.card,
  },
  qrBlock: {
    alignItems: 'center',
    gap: 6,
  },
  qrCard: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: playroomColors.surface,
  },
  status: {
    minWidth: 560,
    paddingVertical: 10,
  },
  grid: {
    width: 900,
    padding: 20,
    borderRadius: 36,
    backgroundColor: playroomColors.lavender,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 20,
    // Heads break out of the top of their circles, so rows need room above.
    rowGap: 30,
    marginTop: 0,
  },
  seat: {
    width: 145,
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
  // An open seat reads as an invitation from across the room: a dashed ring
  // around a soft figure, rather than a grey disc that disappears on the panel.
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
  name: {
    marginTop: 6,
    maxWidth: 145,
  },
  nameSpacer: {
    marginTop: 6,
    height: playroomTv.type.caption.lineHeight,
  },
  tag: {
    position: 'absolute',
    top: 100 - 26,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  tagAway: {
    backgroundColor: playroomColors.disabled,
  },
  tagText: {
    ...playroomTv.type.caption,
    letterSpacing: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  footerText: {
    // Long host names wrap inside the 720-wide column instead of clipping.
    flexShrink: 1,
    textAlign: 'left',
  },
});
