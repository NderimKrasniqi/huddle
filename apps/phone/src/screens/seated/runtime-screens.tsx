import type { GameEvent, GameModule, GamePlayer, PhoneFeedback } from '@huddle/domain';
import { playroomPhone } from '@huddle/design-tokens';
import type { RunningGameScreen } from '@huddle/game-registry';
import { PlayroomButton, PlayroomHeading, PlayroomStatusImage, PlayroomText } from '@huddle/ui/native';
import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RosterSeat } from '../../features/room';
import type { PlayerSession } from '../../platform/session';
import type { BusyAction } from '../use-room-action';
import { PhoneFrame, PhoneNotice, PhoneTopBar, type PhoneTopBarProps } from './phone-frame';

export function PhoneRuntimeMount({
  screen,
  roster,
  session,
  failure,
  busy,
  youAreHost,
  onBackToLobby,
  onLeave,
  onEvent,
}: {
  readonly onLeave: () => void;
  readonly screen: Extract<RunningGameScreen, { kind: 'game' | 'finished' }>;
  readonly roster: readonly RosterSeat[];
  readonly session: PlayerSession;
  readonly failure?: string;
  readonly busy: BusyAction;
  readonly youAreHost: boolean;
  readonly onBackToLobby: () => void;
  readonly onEvent: (event: GameEvent) => void;
}) {
  const insets = useSafeAreaInsets();
  const seat = roster.find((candidate) => candidate.playerId === session.playerId);
  const player: GamePlayer =
    seat === undefined
      ? { playerId: session.playerId, nickname: session.nickname, away: false, avatar: session.avatar }
      : { playerId: seat.playerId, nickname: seat.nickname, away: seat.away, avatar: seat.avatar };
  const module = screen.module as GameModule<unknown, GameEvent>;
  const finished = screen.kind === 'finished';
  const hostBackToLobby = youAreHost && finished;
  const footerHeight = finished ? (hostBackToLobby ? 2 : 1) * playroomPhone.buttonHeight + (hostBackToLobby ? FOOTER_GAP : 0) + RUNTIME_BACK_TO_LOBBY_OFFSET : 0;
  return (
    <View style={styles.runtime} testID={`phone-runtime-${module.metadata.id}`}>
      {module.screens.phone({
        state: screen.state,
        player,
        sendEvent: onEvent,
        safeAreaInsets: insets,
        hostChromeInsetTop: undefined,
        hostChromeInsetBottom: finished ? footerHeight : undefined,
        clockRemainingMs: screen.kind === 'game' ? screen.clockRemainingMs : undefined,
        isHost: youAreHost,
        feedback: phoneFeedback,
        hostNickname: roster.find((candidate) => candidate.host)?.nickname,
        players: roster.map((candidate) => ({ playerId: candidate.playerId, nickname: candidate.nickname, away: candidate.away, avatar: candidate.avatar })),
      })}
      {finished ? (
        <View pointerEvents="box-none" style={[styles.runtimeOverlay, styles.finishedFooter, { bottom: insets.bottom + RUNTIME_BACK_TO_LOBBY_OFFSET, left: insets.left + 24, right: insets.right + 24 }]}>
          {hostBackToLobby ? (
            <PlayroomButton label="Back to lobby" onPress={onBackToLobby} accessibilityLabel="Back to lobby" testID="runtime-back-to-lobby" />
          ) : null}
          <PlayroomButton label="Leave room" variant="secondary" onPress={onLeave} accessibilityLabel="Leave room" testID="runtime-leave-room" />
        </View>
      ) : null}
      {busy === 'event' || failure ? (
        <View pointerEvents="none" style={[styles.runtimeOverlay, { bottom: insets.bottom + 8, left: insets.left + 16, right: insets.right + 16 }]}>
          {busy === 'event' ? <PlayroomText style={[playroomPhone.type.caption, styles.center]}>Sending…</PlayroomText> : null}
          {failure ? <PhoneNotice testID="runtime-error">{failure}</PhoneNotice> : null}
        </View>
      ) : null}
    </View>
  );
}

export function PhoneRuntimeStatus({
  variant,
  title,
  message,
  youAreHost,
  failure,
  busy,
  primary,
  onBackToLobby,
  you,
  hostNickname,
}: {
  readonly hostNickname?: string;
  readonly variant: 'paused' | 'unavailable';
  readonly title: string;
  readonly message: string;
  readonly youAreHost: boolean;
  readonly failure?: string;
  readonly busy: BusyAction;
  readonly primary?: { readonly label: string; readonly onPress: () => void; readonly action: Exclude<BusyAction, null> };
  readonly onBackToLobby: () => void;
  readonly you: PhoneTopBarProps['you'];
}) {
  return (
    <PhoneFrame
      testID={`phone-runtime-${variant}`}
      avatarId={you?.avatarId}
      footer={
        youAreHost ? (
          <>
            {primary ? (
              <PlayroomButton label={primary.label} onPress={primary.onPress} busy={busy === primary.action} accessibilityLabel={primary.label} testID={`runtime-${primary.action}`} />
            ) : null}
            <PlayroomButton
              label="Back to lobby"
              variant={primary ? 'secondary' : 'primary'}
              onPress={onBackToLobby}
              busy={busy === 'end'}
              accessibilityLabel="Back to lobby"
              testID="runtime-status-back-to-lobby"
            />
          </>
        ) : undefined
      }
    >
      <PhoneTopBar you={you} />
      <View style={styles.status}>
        <PlayroomStatusImage art={variant === 'paused' ? 'paused' : 'disconnected'} width={220} height={220} />
        <PlayroomHeading type={playroomPhone.type.heading}>{title}</PlayroomHeading>
        <PlayroomText color="muted" style={[playroomPhone.type.body, styles.center]}>
          {message}
        </PlayroomText>
        {youAreHost ? null : (
          <PlayroomText color="muted" style={[playroomPhone.type.caption, styles.center]}>
            {disconnectedHint(hostNickname, primary !== undefined)}
          </PlayroomText>
        )}
        {failure ? <PhoneNotice testID="runtime-status-error">{failure}</PhoneNotice> : null}
      </View>
    </PhoneFrame>
  );
}

function disconnectedHint(hostNickname: string | undefined, canContinue: boolean): string {
  return `${hostNickname ?? 'The host'} can ${canContinue ? 'continue without them or ' : ''}head back to the room.`;
}

function phoneFeedback(kind: PhoneFeedback): void {
  if (kind === 'select') void Haptics.selectionAsync();
  else void Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
}

const FOOTER_GAP = 12;

const RUNTIME_BACK_TO_LOBBY_OFFSET = 24;

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
  },
  runtime: {
    flex: 1,
  },
  runtimeOverlay: {
    position: 'absolute',
    gap: 4,
  },
  finishedFooter: {
    gap: FOOTER_GAP,
  },
  status: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
});
