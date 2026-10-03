import type { GameEvent, GameModule, GamePlayer } from '@huddle/domain';
import { playroomColors, playroomPhone, playroomRadii } from '@huddle/design-tokens';
import type { RunningGameScreen } from '@huddle/game-registry';
import { PlayroomButton, PlayroomHeading, PlayroomStatusImage, PlayroomText } from '@huddle/ui/native';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RosterSeat } from '../features/room';
import type { PlayerSession } from '../platform/session';
import { PhoneLoadingScreen } from '../ui/native';
import { LobbyScreen, ManagePlayerScreen } from './seated/lobby-screen';
import { PhoneFrame, PhoneNotice, PhoneTopBar, type PhoneTopBarProps } from './seated/phone-frame';
import { PickerScreen } from './seated/picker-screen';
import { SetupScreen } from './seated/setup-screen';
import { useSeatedRoom, type BusyAction, type Confirmation } from './use-seated-room';

/** The picker and setup screens, under the names the render tests use. */
export { PickerScreen as PickerSurface } from './seated/picker-screen';
export { SetupScreen as SetupSurface } from './seated/setup-screen';

/**
 * A seated phone: routes the room's state to the Playroom screen for it.
 * Everything it knows and can do comes from `useSeatedRoom`.
 */
export function SeatedPhone({
  session,
  onSeatLost,
  onLeft,
}: {
  readonly session: PlayerSession;
  readonly onSeatLost: (reason: string) => void;
  readonly onLeft: () => void | Promise<void>;
}) {
  const room = useSeatedRoom({ session, onSeatLost, onLeft });
  const {
    roster,
    running,
    browsingAt,
    setupDraft,
    standing,
    screen,
    installedOrSelectedModule,
    hostPicker,
    guestPicker,
    busy,
    failure,
    success,
    confirmation,
    managedPlayer,
  } = room;
  const me = roster.find((seat) => seat.playerId === session.playerId);
  const you = { nickname: me?.nickname ?? session.nickname, avatarId: me?.avatar ?? session.avatar };
  const sheet = <ConfirmationSheet confirmation={confirmation} busy={busy} failure={failure} onCancel={room.dismissConfirmation} />;

  if (screen.kind === 'game' || screen.kind === 'finished') {
    return (
      <>
        <PhoneRuntimeMount
          screen={screen}
          roster={roster}
          session={session}
          failure={failure}
          busy={busy}
          youAreHost={standing.youAreHost}
          onBackToLobby={room.end}
          onEvent={room.event}
        />
        {sheet}
      </>
    );
  }

  if (screen.kind === 'paused' || screen.kind === 'unavailable') {
    const disconnected = screen.kind === 'paused' && screen.reason === 'playerDisconnected';
    return (
      <>
        <PhoneRuntimeStatus
          variant={screen.kind}
          title={screen.kind === 'paused' ? 'Game paused' : 'Game unavailable'}
          message={
            screen.kind === 'unavailable'
              ? 'This game could not be restored on this phone. The host can return the room to the lobby.'
              : disconnected
                ? 'A player’s phone went quiet. The room will resume when everyone is back.'
                : 'The TV is reconnecting. Keep Huddle open on the phones.'
          }
          youAreHost={standing.youAreHost}
          failure={failure}
          busy={busy}
          primary={disconnected ? { label: 'Continue without waiting', onPress: room.continueGame, action: 'continue' } : undefined}
          onBackToLobby={room.end}
          you={you}
        />
        {sheet}
      </>
    );
  }

  if (running === undefined) {
    return <PhoneLoadingScreen phase="restoring" />;
  }

  if (hostPicker || guestPicker) {
    if (setupDraft !== null && setupDraft !== undefined && installedOrSelectedModule !== undefined) {
      return (
        <>
          <SetupScreen
            module={installedOrSelectedModule}
            setup={setupDraft}
            roster={roster}
            playerId={session.playerId}
            you={you}
            youAreHost={standing.youAreHost}
            busy={busy}
            failure={failure}
            onConfigure={room.configure}
            onFinalize={room.finalize}
            onReopen={room.reopen}
            onCancel={() => room.confirmReturnToRoom(true)}
            onReady={room.toggleReady}
            onStart={room.start}
            onStop={room.stopCountdown}
            onLeave={room.confirmLeave}
          />
          {sheet}
        </>
      );
    }
    return (
      <>
        <PickerScreen
          browsingAt={browsingAt ?? 0}
          youAreHost={standing.youAreHost}
          hostNickname={standing.hostNickname}
          hostAvatar={standing.hostAvatar}
          you={you}
          roster={roster}
          busy={busy}
          failure={failure}
          onBrowse={room.browse}
          onChoose={room.chooseGame}
          onBackToRoom={() => room.confirmReturnToRoom(false)}
          onLeave={room.confirmLeave}
        />
        {sheet}
      </>
    );
  }

  if (managedPlayer !== undefined) {
    return (
      <>
        <ManagePlayerScreen
          player={managedPlayer}
          you={you}
          busy={busy}
          onBack={room.dismissManagedPlayer}
          onTransfer={room.confirmTransfer}
          onRemove={room.confirmRemove}
        />
        {sheet}
      </>
    );
  }

  return (
    <>
      <LobbyScreen
        session={session}
        returned={room.returned}
        welcoming={room.welcoming}
        roster={roster}
        standing={standing}
        busy={busy}
        failure={failure}
        success={success}
        onOpenPicker={room.openPicker}
        onManage={room.managePlayer}
        onLeave={room.confirmLeave}
      />
      {sheet}
    </>
  );
}

function PhoneRuntimeMount({
  screen,
  roster,
  session,
  failure,
  busy,
  youAreHost,
  onBackToLobby,
  onEvent,
}: {
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
  const hostBackToLobby = youAreHost && screen.kind === 'finished';
  return (
    <View style={styles.runtime} testID={`phone-runtime-${module.metadata.id}`}>
      {module.screens.phone({
        state: screen.state,
        player,
        sendEvent: onEvent,
        safeAreaInsets: insets,
        // The game draws its own controls; host navigation returns only at the
        // finished boundary, never over private answer or vote controls.
        hostChromeInsetTop: undefined,
        // Reserve room for the Host's Back to lobby button below, so the
        // finished screen's own footer is not drawn underneath it.
        hostChromeInsetBottom: hostBackToLobby ? RUNTIME_BACK_TO_LOBBY_OFFSET + playroomPhone.buttonHeight : undefined,
        clockRemainingMs: screen.kind === 'game' ? screen.clockRemainingMs : undefined,
        isHost: youAreHost,
      })}
      {hostBackToLobby ? (
        <View pointerEvents="box-none" style={[styles.runtimeOverlay, { bottom: insets.bottom + RUNTIME_BACK_TO_LOBBY_OFFSET, left: insets.left + 24, right: insets.right + 24 }]}>
          <PlayroomButton label="Back to lobby" onPress={onBackToLobby} accessibilityLabel="Back to lobby" testID="runtime-back-to-lobby" />
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

function PhoneRuntimeStatus({
  variant,
  title,
  message,
  youAreHost,
  failure,
  busy,
  primary,
  onBackToLobby,
  you,
}: {
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
      {/* The same top bar as every seated screen, so a pause never looks like a different app. */}
      <PhoneTopBar you={you} />
      <View style={styles.status}>
        <PlayroomStatusImage art={variant === 'paused' ? 'paused' : 'disconnected'} width={220} height={220} />
        <PlayroomHeading type={playroomPhone.type.heading}>{title}</PlayroomHeading>
        <PlayroomText color="muted" style={[playroomPhone.type.body, styles.center]}>
          {message}
        </PlayroomText>
        {youAreHost ? null : (
          <PlayroomText color="muted" style={[playroomPhone.type.caption, styles.center]}>
            Waiting for the host to return to the room.
          </PlayroomText>
        )}
        {failure ? <PhoneNotice testID="runtime-status-error">{failure}</PhoneNotice> : null}
      </View>
    </PhoneFrame>
  );
}

/** Confirmation sheet for destructive room and lifecycle actions. */
function ConfirmationSheet({
  confirmation,
  busy,
  failure,
  onCancel,
}: {
  readonly confirmation: Confirmation | undefined;
  readonly busy: BusyAction;
  readonly failure?: string;
  readonly onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (confirmation === undefined) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel} accessibilityViewIsModal testID="heartbeat-confirmation-modal">
      <View style={[styles.scrim, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.sheet}>
          <View style={styles.grab} />
          <PlayroomText accessibilityRole="header" style={[playroomPhone.type.heading, styles.center]}>
            {confirmation.title}
          </PlayroomText>
          <PlayroomText color="muted" style={[playroomPhone.type.body, styles.center]}>
            {confirmation.message}
          </PlayroomText>
          {failure ? <PhoneNotice testID="confirmation-error">{failure}</PhoneNotice> : null}
          <PlayroomButton
            label={confirmation.confirmLabel}
            variant={confirmation.destructive ? 'destructive' : 'primary'}
            onPress={confirmation.onConfirm}
            busy={busy === confirmation.action}
            accessibilityLabel={confirmation.confirmLabel}
            testID="confirmation-confirm"
          />
          <PlayroomButton label="Cancel" variant="secondary" onPress={onCancel} disabled={busy !== null} accessibilityLabel="Cancel" testID="confirmation-cancel" />
        </View>
      </View>
    </Modal>
  );
}

// Gap between the device's bottom inset and the Host's Back to lobby button.
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
  // Below the top bar, the status itself stays centred in the remaining space.
  status: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    backgroundColor: 'rgba(45, 11, 78, 0.35)',
  },
  sheet: {
    gap: 12,
    padding: 20,
    borderRadius: playroomRadii.card,
    backgroundColor: playroomColors.canvas,
  },
  grab: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: playroomColors.border,
  },
});
