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
import Animated, {
  Easing,
  Keyframe,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

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

/** Someone new dropping into their seat: a rare, happy moment, so it bounces once. */
const SEAT_DROP_IN = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -60 }, { scale: 0.9 }] },
  60: { opacity: 1, transform: [{ translateY: 6 }, { scale: 1.04 }], easing: Easing.bezier(...playroomEasing.out) },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Easing.bezier(...playroomEasing.inOut) },
})
  .duration(520)
  .reduceMotion(ReduceMotion.System);

/** How far a seat rises: the middle seats sit highest, like a row round the couch. */
function arcLift(position: number): number {
  return Math.round(Math.sin((Math.PI * (position + 0.5)) / PLAYER_CAPACITY) * 64);
}

/** The stable roster data needed by the display-only invitation renderer. */
export type RoomInvitationPlayer = {
  readonly id: string;
  readonly name: string;
  readonly avatarId?: AvatarId;
  readonly host?: boolean;
  readonly away?: boolean;
};

/** Someone on the join form: the avatar and name they are picking. */
export type RoomInvitationArrival = {
  readonly id: string;
  readonly name: string;
  readonly avatarId: AvatarId;
};

export type RoomInvitationScreenProps = {
  readonly welcomeIds?: readonly string[];
  /** People still on the join form; they fill the next empty seats, faded. */
  readonly arriving?: readonly RoomInvitationArrival[];
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
  arriving = [],
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
        {/* The lounge sets the scene behind everything; the code is the hero. */}
        <PlayroomMoment art="lounge" width={1100} height={550} glow style={styles.backdrop} />
        <View style={styles.stack} pointerEvents="none" focusable={false}>
          <PlayroomText accessibilityRole="header" style={[playroomTv.type.heading, styles.center]} testID="room-invitation-heading">
            {joined === 0 ? 'Grab your phone and join in' : joined >= PLAYER_CAPACITY ? 'Everyone’s here!' : 'Make yourself at home.'}
          </PlayroomText>
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
                    <PlayroomText style={styles.tileLetter}>{letter}</PlayroomText>
                  </View>
                ))}
              </View>
              <PlayroomText color="muted" style={playroomTv.type.label}>Type this code on your phone</PlayroomText>
            </View>
            <View
              style={styles.qrBlock}
              accessible
              accessibilityRole="image"
              accessibilityLabel={`QR code to join room ${spokenCode}`}
              focusable={false}
            >
              <View style={styles.qrCard}>
                <QRCode value={joinUrl} size={200} color={playroomColors.ink} backgroundColor={playroomColors.surface} testID="room-join-qr" />
              </View>
              <PlayroomText color="muted" style={playroomTv.type.label} accessibilityElementsHidden>
                Scan to join
              </PlayroomText>
            </View>
          </View>
          <View style={styles.statusRow}>
            <PlayroomPill style={styles.status} textStyle={playroomTv.type.label} testID="room-roster-count">
              {joined >= PLAYER_CAPACITY ? `Room full · ${PLAYER_CAPACITY} / ${PLAYER_CAPACITY}` : `${joined} / ${PLAYER_CAPACITY} joined`}
            </PlayroomPill>
            <PlayroomText style={[playroomTv.type.label, styles.footerLine]} testID="room-invitation-footer">
              {joined === 0
                ? 'The first phone to join becomes the host'
                : joined < 2
                  ? `${hostName || 'The host'} is the host · waiting for one more player`
                  : `${hostName || 'The host'} is choosing what’s next`}
            </PlayroomText>
          </View>
        </View>
        <View style={styles.greeting}>
            {welcomeIds.length > 0 ? <View style={styles.welcome} accessible accessibilityLiveRegion="polite"
              accessibilityLabel={`${visiblePlayers.filter((player) => welcomeIds.includes(player.id)).map((player) => player.name).join(', ')} joined the room`} testID="tv-join-welcome">
              {visiblePlayers.filter((player) => welcomeIds.includes(player.id)).slice(0, 3).map((player) =>
                player.avatarId ? <PlayroomAvatar key={player.id} avatarId={player.avatarId} size={56} /> : null)}
              <PlayroomText style={playroomTv.type.label}>{welcomeIds.length === 1 ? `${visiblePlayers.find((player) => player.id === welcomeIds[0])?.name ?? 'Your friend'} is in!` : `${welcomeIds.length} new faces. Welcome in!`}</PlayroomText>
            </View> : null}
        </View>
        <View style={styles.seats} pointerEvents="none" focusable={false}>
          <View style={styles.grid} pointerEvents="none" focusable={false} testID="player-grid">
            {Array.from({ length: PLAYER_CAPACITY }, (_unused, position) => {
              const player = visiblePlayers[position];
              const arrival = player ? undefined : arriving[position - joined];
              const seat = arrival ? (
                <ArrivingSeat arrival={arrival} reduceMotion={reduceMotion} />
              ) : player ? (
                <JoinedPlayer player={player} arrivalDelay={firstShow ? position * playroomMotion.stagger : 0} justArrived={!firstShow && welcomeIds.includes(player.id)} reduceMotion={reduceMotion} />
              ) : (
                <EmptySlot position={position} />
              );
              return (
                <Animated.View
                  key={arrival ? `arriving-${arrival.id}` : player ? player.id : `empty-${position + 1}`}
                  style={{ marginBottom: arcLift(position) }}
                >
                  {seat}
                </Animated.View>
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
  justArrived = false,
  reduceMotion,
}: {
  readonly player: RoomInvitationPlayer;
  readonly arrivalDelay: number;
  /** Joined while the room was already showing: drop in and light up the name. */
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

/** Someone choosing their look on the join form: faded, ringed, gently breathing. */
function ArrivingSeat({ arrival, reduceMotion }: { readonly arrival: RoomInvitationArrival; readonly reduceMotion: boolean }) {
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
  // Behind the seats, not the code: the couch the room gathers round.
  backdrop: { position: 'absolute', left: 410, bottom: 20, opacity: 0.28, alignItems: 'center' },
  stack: { position: 'absolute', left: playroomTv.safeX, right: playroomTv.safeX, top: 168, alignItems: 'center', gap: 34 },
  center: { textAlign: 'center' },
  statusRow: { alignSelf: 'stretch', alignItems: 'center', gap: 14 },
  footerLine: { alignSelf: 'stretch', textAlign: 'center' },
  tileLetter: { ...playroomTv.type.roomCode, fontSize: 132, lineHeight: 140 },
  greeting: { position: 'absolute', left: 0, right: 0, bottom: 300, height: 80, alignItems: 'center', justifyContent: 'center' },
  // The room along the bottom, one row of ten, lifted at the middle like seats round a couch.
  seats: { position: 'absolute', left: playroomTv.safeX, right: playroomTv.safeX, bottom: playroomTv.safeY, alignItems: 'center' },
  welcome: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 28, backgroundColor: playroomColors.successSurface },
  // The code owns the centre; the QR waits off to the right for anyone scanning.
  joinRow: {
    alignSelf: 'stretch',
    alignItems: 'center',
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
    width: 156,
    height: 184,
    borderRadius: playroomRadii.card,
    backgroundColor: playroomColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...playroomShadows.card,
  },
  qrBlock: {
    position: 'absolute',
    right: 60,
    top: -10,
    alignItems: 'center',
    gap: 6,
  },
  qrCard: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: playroomColors.surface,
  },
  status: {
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  // Seats sit on the room itself; lavender is kept for selection and status.
  grid: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    columnGap: 16,
  },
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
  // Someone choosing their look: the seat they are heading for, ringed in the
  // room's orange and held back until they join.
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
  // A new arrival's name, lit for the few seconds the room says hello.
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
  // A status sits above the head like a little speech tag, clear of the name below.
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
    fontSize: 22,
    lineHeight: 28,
    fontFamily: playroomTv.type.title.fontFamily,
    letterSpacing: 0.5,
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
