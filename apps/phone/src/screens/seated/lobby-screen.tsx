import { ROOM_PLAYER_CAP } from '@huddle/domain';
import { playroomColors, playroomEasing, playroomMotion, playroomPhone, playroomRadii, playroomShadows } from '@huddle/design-tokens';
import {
  PlayroomAvatar,
  PlayroomButton,
  PlayroomHeading,
  PlayroomPill,
  PlayroomMoment,
  PlayroomText,
  PlayroomPressable,
} from '@huddle/ui/native';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe, ReduceMotion } from 'react-native-reanimated';

import { rosterRowControls, type lobbyStanding, type RosterSeat } from '../../features/room';
import type { PlayerSession } from '../../platform/session';
import type { BusyAction } from '../use-seated-room';
import { PhoneCard, PhoneFrame, PhoneNotice, PhoneTopBar } from './phone-frame';

export type LobbyScreenProps = {
  readonly session: PlayerSession;
  readonly returned?: boolean;
  readonly welcoming?: boolean;
  readonly roster: readonly RosterSeat[];
  readonly standing: ReturnType<typeof lobbyStanding>;
  readonly busy: BusyAction;
  readonly failure?: string;
  readonly success?: string;
  readonly onOpenPicker: () => void;
  readonly onManage: (seat: RosterSeat) => void;
  readonly onLeave: () => void;
};

/** The room before a game: the host sees everyone and chooses; guests wait. */
export function LobbyScreen(props: LobbyScreenProps) {
  const { session, roster, standing, busy, failure, success, onOpenPicker, onLeave, returned, welcoming } = props;
  const me = roster.find((seat) => seat.playerId === session.playerId);
  const avatarId = me?.avatar ?? session.avatar;
  const you = { nickname: me?.nickname ?? session.nickname, avatarId };

  return (
    <PhoneFrame
      avatarId={avatarId}
      testID="phone-lobby"
      footer={
        <>
          {standing.youAreHost ? (
            <PlayroomButton
              label={returned ? "Choose next game" : "Choose a game"}
                onPress={onOpenPicker}
              busy={busy === 'browse'}
              accessibilityLabel="Pick a game"
              testID="open-game-picker"
            />
          ) : null}
          <PlayroomButton label="Leave room" variant="link" onPress={onLeave} busy={busy === 'leave'} accessibilityLabel="Leave room" testID="leave-room" />
        </>
      }
    >
      <PhoneTopBar you={you} />
      {welcoming && !returned ? <PhoneCard style={styles.welcome}>
        <PlayroomText color="success" style={playroomPhone.type.title} accessibilityLiveRegion="polite">Your seat is saved.</PlayroomText>
        <PlayroomText color="success" style={playroomPhone.type.body}>Look up—the room says hello.</PlayroomText>
      </PhoneCard> : null}
      {returned ? <>
        <PlayroomMoment art="highFive" width={280} height={240} style={styles.moment} />
        <PlayroomHeading type={playroomPhone.type.hero}>One more?</PlayroomHeading>
        <PlayroomText color="muted" style={[playroomPhone.type.body, styles.center]}>
          {standing.youAreHost ? 'Same people. New surprises. Choose what’s next.' : `${standing.hostNickname ?? 'The host'} is choosing what’s next. Your seat stays yours.`}
        </PlayroomText>
      </> : standing.youAreHost ? <HostLobby {...props} /> : <GuestLobby {...props} />}
      {failure ? <PhoneNotice testID="phone-lifecycle-error">{failure}</PhoneNotice> : null}
      {success ? (
        <PlayroomPill tone="success" textStyle={playroomPhone.type.caption} testID="phone-lifecycle-success">
          {success}
        </PlayroomPill>
      ) : null}
    </PhoneFrame>
  );
}

function HostLobby({ session, roster, onManage }: LobbyScreenProps) {
  return (
    <>
      <PlayroomHeading type={playroomPhone.type.heading}>Your people</PlayroomHeading>
      <View style={styles.code} accessible accessibilityLabel={`Room code ${session.code.split('').join(' ')}`} testID="phone-room-code-tiles">
        <PlayroomText style={playroomPhone.type.code} accessibilityElementsHidden>
          {session.code}
        </PlayroomText>
      </View>
      <PlayroomPill textStyle={playroomPhone.type.caption}>{`${roster.length} / ${ROOM_PLAYER_CAP} players`}</PlayroomPill>
      <View style={styles.grid}>
        {roster.map((seat) => {
          const manageable = rosterRowControls(seat).length > 0;
          const tile = <PlayerTile seat={seat} />;
          return manageable ? (
            <PlayroomPressable
              key={seat.playerId}
              onPress={() => onManage(seat)}
              accessibilityRole="button"
              accessibilityLabel={`Manage ${seat.nickname}`}
              accessibilityHint="Opens player actions"
              testID={`manage-player-${seat.playerId}`}
              style={styles.cell}
            >
              {tile}
            </PlayroomPressable>
          ) : (
            <View key={seat.playerId} style={styles.cell} testID={`lobby-player-${seat.playerId}`}>
              {tile}
            </View>
          );
        })}
      </View>
    </>
  );
}

/** A player arriving in the lobby, the same arrival the TV gives their seat. */
const TILE_ARRIVAL = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.9 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.bezier(...playroomEasing.out) },
})
  .duration(playroomMotion.entrance)
  .reduceMotion(ReduceMotion.System);

function PlayerTile({ seat }: { readonly seat: RosterSeat }) {
  return (
    <Animated.View entering={TILE_ARRIVAL} style={styles.tile}>
      <PlayroomAvatar avatarId={seat.avatar} size={playroomPhone.avatar.tile} host={seat.host} away={seat.away} />
      <View style={styles.tileText}>
        <PlayroomText numberOfLines={1} style={styles.tileName}>
          {seat.nickname}
        </PlayroomText>
        {seat.host ? <Tag label="HOST" tone="host" /> : seat.away ? <Tag label="AWAY" tone="away" /> : null}
      </View>
    </Animated.View>
  );
}

function Tag({ label, tone }: { readonly label: string; readonly tone: 'host' | 'away' }) {
  return (
    <View style={[styles.tag, { backgroundColor: tone === 'host' ? playroomColors.orange : playroomColors.disabled }]}>
      <PlayroomText style={styles.tagText}>{label}</PlayroomText>
    </View>
  );
}

function GuestLobby({ session, roster }: LobbyScreenProps) {
  const me = roster.find((seat) => seat.playerId === session.playerId);
  const host = roster.find((seat) => seat.host);
  return (
    <>
      <PlayroomHeading type={playroomPhone.type.heading}>You’re in!</PlayroomHeading>
      <PhoneCard style={styles.pass}>
        <PlayroomAvatar avatarId={me?.avatar ?? session.avatar} size={88} />
        <View style={styles.infoText}>
          <PlayroomText style={playroomPhone.type.title}>{me?.nickname ?? session.nickname}</PlayroomText>
          <PlayroomText color="muted" style={playroomPhone.type.body}>{`Room ${session.code} · ${me?.away ? 'Reconnecting' : 'Connected'}`}</PlayroomText>
        </View>
      </PhoneCard>
      <PlayroomMoment art="tvHandoff" width={240} height={190} style={styles.moment} />
      {host ? (
        <PhoneCard style={styles.infoCard}>
          <PlayroomAvatar avatarId={host.avatar} size={52} host />
          <View style={styles.infoText}>
            <PlayroomText style={playroomPhone.type.title}>{`${host.nickname} is the host`}</PlayroomText>
            <PlayroomText color="muted" style={playroomPhone.type.body}>They pick the games</PlayroomText>
          </View>
        </PhoneCard>
      ) : null}

    </>
  );
}

export type ManagePlayerScreenProps = {
  readonly player: RosterSeat;
  readonly you: { readonly nickname: string; readonly avatarId: RosterSeat['avatar'] };
  readonly busy: BusyAction;
  readonly onBack: () => void;
  readonly onTransfer: (seat: RosterSeat) => void;
  readonly onRemove: (seat: RosterSeat) => void;
};

/** Host actions for one player, as a full screen. */
export function ManagePlayerScreen({ player, you, busy, onBack, onTransfer, onRemove }: ManagePlayerScreenProps) {
  const controls = rosterRowControls(player);
  return (
    <PhoneFrame
      avatarId={you.avatarId}
      testID="player-management-modal"
      footer={<PlayroomButton label="Back to room" variant="link" onPress={onBack} disabled={busy !== null} accessibilityLabel="Cancel" testID="manage-cancel" />}
    >
      <PhoneTopBar back={{ label: 'Manage player', onPress: onBack }} you={you} />
      <View style={styles.managed} testID="managed-player">
        <PlayroomAvatar avatarId={player.avatar} size={176} away={player.away} />
        <PlayroomText style={playroomPhone.type.hero}>{player.nickname}</PlayroomText>
        <View style={styles.presence}>
          <View style={[styles.dot, { backgroundColor: player.away ? playroomColors.border : playroomColors.success }]} />
          <PlayroomText style={playroomPhone.type.label}>{player.away ? 'Away' : 'Connected'}</PlayroomText>
        </View>
      </View>
      <View style={styles.actions}>
        {controls.map((control) => (
          <View key={control.action} style={styles.action}>
            <PlayroomButton
              label={control.action === 'remove' ? 'Remove player' : control.label}
              variant={control.action === 'remove' ? 'destructive' : 'lavender'}
              disabled={!control.enabled}
              busy={busy === control.action}
              onPress={() => (control.action === 'transfer' ? onTransfer(player) : onRemove(player))}
              accessibilityLabel={`${control.label} ${player.nickname}`}
              testID={`manage-${control.action}-${player.playerId}`}
            />
            {control.disabledBecause ? (
              <PlayroomText color="muted" style={[playroomPhone.type.caption, styles.center]}>
                {control.disabledBecause}
              </PlayroomText>
            ) : null}
          </View>
        ))}
      </View>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  welcome: { backgroundColor: playroomColors.successSurface, gap: 4 },
  moment: { alignItems: 'center' },
  // A white card like every other container; lavender is for selection and status.
  pass: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  code: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: playroomRadii.button,
    backgroundColor: playroomColors.surface,
    ...playroomShadows.card,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell: {
    width: '48.5%',
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 64,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: playroomColors.surface,
    ...playroomShadows.card,
  },
  tileText: {
    flex: 1,
    gap: 2,
    alignItems: 'flex-start',
  },
  tileName: {
    ...playroomPhone.type.label,
    fontFamily: playroomPhone.type.title.fontFamily,
    alignSelf: 'stretch',
  },
  tag: {
    paddingHorizontal: 8,
    borderRadius: playroomRadii.pill,
  },
  tagText: {
    fontFamily: playroomPhone.type.title.fontFamily,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.8,
  },
  me: {
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  infoText: {
    flex: 1,
  },
  managed: {
    alignItems: 'center',
    gap: 8,
    marginTop: 36,
  },
  presence: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  actions: {
    gap: 12,
    marginTop: 24,
  },
  action: {
    gap: 6,
  },
  center: {
    textAlign: 'center',
  },
});
