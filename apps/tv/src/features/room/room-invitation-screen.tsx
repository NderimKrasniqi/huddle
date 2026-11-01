import { ROOM_PLAYER_CAP } from '@huddle/domain';
import {
  playroomColors,
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
import { Fragment, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTvReducedMotion } from '../../ui';
import { ArrivingSeat, EmptySlot, JoinedPlayer, type RoomInvitationArrival, type RoomInvitationPlayer } from './room-seats';

const PLAYER_CAPACITY = ROOM_PLAYER_CAP;

function arcLift(position: number): number {
  return Math.round(Math.sin((Math.PI * (position + 0.5)) / PLAYER_CAPACITY) * 64);
}

export type { RoomInvitationPlayer };

export type RoomInvitationScreenProps = {
  readonly welcomeIds?: readonly string[];
  readonly arriving?: readonly RoomInvitationArrival[];
  readonly roomCode: string;
  readonly joinUrl: string;
  readonly players?: readonly RoomInvitationPlayer[];
  readonly reduceMotion?: boolean;
};

export function RoomInvitationScreen({
  roomCode,
  joinUrl,
  players = [],
  arriving = [],
  welcomeIds = [],
  reduceMotion: reduceMotionOverride,
}: RoomInvitationScreenProps) {
  const reduceMotion = useTvReducedMotion(reduceMotionOverride);
  const normalizedCode = roomCode.trim().toUpperCase().slice(0, 4);
  const spokenCode = normalizedCode.split('').join(' ');
  const visiblePlayers = players.slice(0, PLAYER_CAPACITY);
  const joined = visiblePlayers.length;
  const hostName = visiblePlayers.find((player) => player.host)?.name.trim();
  const [firstShow, setFirstShow] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setFirstShow(false), PLAYER_CAPACITY * playroomMotion.stagger + playroomMotion.entrance);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.viewport} pointerEvents="none" focusable={false} accessible={false} testID="room-invitation-viewport">
      <PlayroomTvStage testID="room-invitation-stage">
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
                <View key={`seat-${position}`} style={{ marginBottom: arcLift(position) }}>
                  <Fragment key={arrival ? `arriving-${arrival.id}` : player ? player.id : 'empty'}>{seat}</Fragment>
                </View>
              );
            })}
          </View>
        </View>
      </PlayroomTvStage>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    backgroundColor: playroomColors.canvas,
  },
  backdrop: { position: 'absolute', left: 410, bottom: 20, opacity: 0.28, alignItems: 'center' },
  stack: { position: 'absolute', left: playroomTv.safeX, right: playroomTv.safeX, top: 168, alignItems: 'center', gap: 34 },
  center: { textAlign: 'center' },
  statusRow: { alignSelf: 'stretch', alignItems: 'center', gap: 14 },
  footerLine: { alignSelf: 'stretch', textAlign: 'center' },
  tileLetter: { ...playroomTv.type.codeTile },
  greeting: { position: 'absolute', left: 0, right: 0, bottom: 300, height: 80, alignItems: 'center', justifyContent: 'center' },
  seats: { position: 'absolute', left: playroomTv.safeX, right: playroomTv.safeX, bottom: playroomTv.safeY, alignItems: 'center' },
  welcome: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 28, backgroundColor: playroomColors.successSurface },
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
  grid: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    columnGap: 16,
  },
});
