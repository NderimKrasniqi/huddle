import type { AvatarId } from '@huddle/domain';
import { playroomColors, playroomEasing, playroomMotion, playroomTv } from '@huddle/design-tokens';
import {
  PlayroomAvatar,
  PlayroomBurst,
  PlayroomFloat,
  PlayroomHeading,
  PlayroomPill,
  PlayroomText,
  PlayroomTvStage,
} from '@huddle/ui/native';
import QRCode from 'react-native-qrcode-svg';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe, ReduceMotion } from 'react-native-reanimated';

import { resolveTvReducedMotion, useTvSystemReducedMotion } from '../../ui/reduced-motion';

const PLAYER_CAPACITY = 10;

/** A seat's portrait arriving: from 0.9 and transparent, never from nothing. */
function seatArrival(delay: number) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.9 }] },
    100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.bezier(...playroomEasing.out) },
  })
    .duration(playroomMotion.enter)
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
  readonly roomCode: string;
  readonly joinUrl: string;
  readonly players?: readonly RoomInvitationPlayer[];
  /** Overrides the system setting in previews and tests. */
  readonly reduceMotion?: boolean;
};

/**
 * The TV room: the join code and QR straight on the cream, the room's ten
 * seats, and who is running it. Display-only; phones do the joining.
 */
export function RoomInvitationScreen({
  roomCode,
  joinUrl,
  players = [],
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
    const timer = setTimeout(() => setFirstShow(false), PLAYER_CAPACITY * playroomMotion.stagger + playroomMotion.enter);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.viewport} pointerEvents="none" focusable={false} accessible={false} testID="room-invitation-viewport">
      <PlayroomTvStage testID="room-invitation-stage">
        <RoomProps reduceMotion={reduceMotion} />
        <View style={styles.column} pointerEvents="none" focusable={false}>
          <PlayroomHeading type={playroomTv.type.heading} testID="room-invitation-heading">
            {joined >= PLAYER_CAPACITY ? 'Everyone’s here!' : joined === 0 ? 'Grab your phones!' : 'Come on in!'}
          </PlayroomHeading>

          <View style={styles.joinRow} pointerEvents="none" focusable={false}>
            <View
              style={styles.codeBlock}
              accessible
              accessibilityRole="text"
              accessibilityLabel={`Room code ${spokenCode}`}
              focusable={false}
              testID="room-code"
            >
              <PlayroomText color="muted" style={playroomTv.type.subheading}>Join at</PlayroomText>
              <PlayroomText style={[playroomTv.type.code, styles.code]} accessibilityElementsHidden>
                {normalizedCode}
              </PlayroomText>
            </View>
            <View
              style={styles.qrBlock}
              accessible
              accessibilityRole="image"
              accessibilityLabel={`QR code to join room ${spokenCode}`}
              focusable={false}
            >
              <QRCode
                value={joinUrl}
                size={172}
                color={playroomColors.ink}
                backgroundColor={playroomColors.cream}
                testID="room-join-qr"
              />
              <PlayroomText color="inkSoft" style={[playroomTv.type.chip, styles.scanLabel]} accessibilityElementsHidden>
                {'Scan\nto join'}
              </PlayroomText>
            </View>
          </View>

          <PlayroomPill style={styles.status} textStyle={playroomTv.type.status} testID="room-roster-count">
            {joined >= PLAYER_CAPACITY ? `Room full · ${PLAYER_CAPACITY} / ${PLAYER_CAPACITY}` : `${joined} / ${PLAYER_CAPACITY} joined`}
          </PlayroomPill>

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

          <View style={styles.footer} pointerEvents="none" focusable={false}>
            {joined >= 2 ? <PlayroomBurst size={34} side="left" /> : null}
            <PlayroomText style={[playroomTv.type.subheading, styles.footerText]} testID="room-invitation-footer">
              {joined === 0
                ? 'The first phone to join becomes the host'
                : joined < 2
                  ? `${hostName || 'The host'} is the host · waiting for one more player`
                  : `${hostName || 'The host'} is choosing what’s next`}
            </PlayroomText>
            {joined >= 2 ? <PlayroomBurst size={34} side="right" /> : null}
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
        <PlayroomAvatar avatarId={player.avatarId} size={playroomTv.avatar.grid} host={player.host} away={player.away} testID="joined-player-avatar" />
      ) : (
        <View style={styles.initial} pointerEvents="none" focusable={false}>
          <PlayroomText style={playroomTv.type.heading} accessibilityElementsHidden>
            {Array.from(name)[0]?.toLocaleUpperCase() ?? '?'}
          </PlayroomText>
        </View>
      )}
      <PlayroomText numberOfLines={1} style={[playroomTv.type.name, styles.name]} accessibilityElementsHidden>
        {name}
      </PlayroomText>
      {player.host ? <SeatTag label="HOST" tone="host" /> : null}
      {player.away && !player.host ? <SeatTag label="AWAY" tone="away" /> : null}
    </Animated.View>
  );
}

function SeatTag({ label, tone }: { readonly label: string; readonly tone: 'host' | 'away' }) {
  return (
    <View style={[styles.tag, tone === 'host' ? styles.tagHost : styles.tagAway]} pointerEvents="none" focusable={false}>
      <PlayroomText color={tone === 'host' ? 'card' : 'inkSoft'} style={styles.tagText} accessibilityElementsHidden>
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
      <View style={styles.empty} pointerEvents="none" focusable={false}>
        <PlayroomText color="soonText" style={playroomTv.type.name} accessibilityElementsHidden>
          {position + 1}
        </PlayroomText>
      </View>
      <PlayroomText color="soonText" style={[playroomTv.type.name, styles.name]} accessibilityElementsHidden>
        Open
      </PlayroomText>
    </View>
  );
}

/** Clay props around the heading. They bob on arrival; four keep drifting. */
function RoomProps({ reduceMotion }: { readonly reduceMotion: boolean }) {
  return (
    <>
      <PlayroomFloat prop="controller" width={290} height={200} style={{ left: 50, top: 300 }} reduceMotion={reduceMotion} drifts duration={7000} tilt={-4} />
      <PlayroomFloat prop="starPurple" width={92} height={92} style={{ left: 120, top: 190 }} reduceMotion={reduceMotion} duration={5000} delay={300} tilt={12} />
      <PlayroomFloat prop="starYellow" width={100} height={100} style={{ left: 28, top: 238 }} reduceMotion={reduceMotion} duration={6000} delay={700} />
      <PlayroomFloat prop="ballOrange" width={76} height={76} style={{ left: 336, top: 262 }} reduceMotion={reduceMotion} drifts duration={4500} delay={200} />
      <PlayroomFloat prop="ballCream" width={54} height={54} style={{ left: 376, top: 376 }} reduceMotion={reduceMotion} duration={5500} delay={900} />
      <PlayroomFloat prop="ballOrange" width={96} height={96} style={{ right: 96, top: 124 }} reduceMotion={reduceMotion} duration={5000} delay={400} />
      <PlayroomFloat prop="starYellow" width={134} height={134} style={{ right: 200, top: 218 }} reduceMotion={reduceMotion} drifts duration={6500} delay={100} tilt={-8} />
      <PlayroomFloat prop="ballPurple" width={54} height={54} style={{ right: 78, top: 290 }} reduceMotion={reduceMotion} duration={4000} delay={600} />
      <PlayroomFloat prop="starPurple" width={96} height={96} style={{ right: 360, top: 346 }} reduceMotion={reduceMotion} drifts duration={5500} delay={1100} tilt={8} />
      <PlayroomFloat prop="ballCream" width={76} height={76} style={{ right: 150, top: 404 }} reduceMotion={reduceMotion} duration={6000} delay={500} />
    </>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    backgroundColor: playroomColors.cream,
  },
  column: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    paddingTop: playroomTv.safeY + 14,
    gap: 22,
  },
  joinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 80,
  },
  codeBlock: {
    alignItems: 'center',
  },
  code: {
    letterSpacing: 6,
  },
  qrBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  scanLabel: {
    maxWidth: 120,
  },
  status: {
    minWidth: 560,
    paddingVertical: 10,
  },
  grid: {
    width: 1500,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 70,
    rowGap: 10,
    marginTop: 6,
  },
  seat: {
    width: 230,
    alignItems: 'center',
  },
  initial: {
    width: playroomTv.avatar.grid,
    height: playroomTv.avatar.grid,
    borderRadius: playroomTv.avatar.grid / 2,
    backgroundColor: playroomColors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    width: playroomTv.avatar.grid,
    height: playroomTv.avatar.grid,
    borderRadius: playroomTv.avatar.grid / 2,
    borderWidth: 4,
    borderStyle: 'dashed',
    borderColor: playroomColors.lavenderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    marginTop: 6,
    maxWidth: 230,
  },
  tag: {
    position: 'absolute',
    top: playroomTv.avatar.grid - 26,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  tagHost: {
    backgroundColor: playroomColors.orange,
  },
  tagAway: {
    backgroundColor: playroomColors.lavenderStrong,
  },
  tagText: {
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  footerText: {
    textAlign: 'center',
  },
});
