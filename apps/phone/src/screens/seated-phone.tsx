import { nameList } from '@huddle/domain';

import type { PlayerSession } from '../platform/session';
import { PhoneLoadingScreen } from '../ui/native';
import { ConfirmationSheet } from './seated/confirmation-sheet';
import { HostToast, useHostToast } from './seated/host-toast';
import { LobbyScreen, ManagePlayerScreen } from './seated/lobby-screen';
import { PickerScreen } from './seated/picker-screen';
import { PhoneRuntimeMount, PhoneRuntimeStatus } from './seated/runtime-screens';
import { SetupScreen } from './seated/setup-screen';
import { useSeatedRoom } from './use-seated-room';

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
    reduceMotion,
  } = room;
  const hostToast = useHostToast(roster, session.playerId);
  const me = roster.find((seat) => seat.playerId === session.playerId);
  const you = { nickname: me?.nickname ?? session.nickname, avatarId: me?.avatar ?? session.avatar, roomCode: session.code };
  const sheet = (
    <>
      <HostToast toast={hostToast} reduceMotion={reduceMotion !== false} />
      <ConfirmationSheet confirmation={confirmation} busy={busy} failure={failure} onCancel={room.dismissConfirmation} />
    </>
  );

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
          onLeave={room.confirmLeave}
          onEvent={room.event}
        />
        {sheet}
      </>
    );
  }

  if (screen.kind === 'paused' || screen.kind === 'unavailable') {
    const disconnected = screen.kind === 'paused' && screen.reason === 'playerDisconnected';
    const missing = roster.filter((seat) => seat.away).map((seat) => seat.nickname);
    const hostSeat = roster.find((seat) => seat.host);
    return (
      <>
        <PhoneRuntimeStatus
          variant={screen.kind}
          title={screen.kind === 'paused' ? 'Game paused' : 'Game unavailable'}
          message={
            screen.kind === 'unavailable'
              ? `This game could not be restored on this phone. ${hostSeat?.nickname ?? 'The host'} can return the room to the lobby.`
              : disconnected
                ? `${missing.length > 0 ? nameList(missing) : 'A phone'} went quiet. The game resumes when everyone is back.`
                : 'The TV is reconnecting. Keep Huddle open on the phones.'
          }
          youAreHost={standing.youAreHost}
          failure={failure}
          busy={busy}
          primary={disconnected ? { label: 'Continue without waiting', onPress: room.continueGame, action: 'continue' } : undefined}
          onBackToLobby={room.end}
          you={you}
          hostNickname={hostSeat?.nickname}
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
