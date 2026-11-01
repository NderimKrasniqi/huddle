import { useRoomMoments, useSystemReducedMotion } from '@huddle/ui/native';
import { GAME_REGISTRY, runningGameScreen } from '@huddle/game-registry';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  hostControlFailureMessage,
  lobbyStanding,
  seatLossNotice,
  type RosterSeat,
} from '../features/room';
import { useHeartbeat } from '../platform/presence/native';
import { useRoomClient } from '../platform/room-client/native';
import { usePhoneSession, type PlayerSession } from '../platform/session';
import { pickerVisibility } from './seated-phone-model';
import { useGameActions } from './use-game-actions';
import { useRoomAction } from './use-room-action';

export function useSeatedRoom({
  session,
  onSeatLost,
  onLeft,
}: {
  readonly session: PlayerSession;
  readonly onSeatLost: (reason: string) => void;
  readonly onLeft: () => void | Promise<void>;
}) {
  useHeartbeat();
  const { beginLeave, cancelLeave, sessionToken, joinWelcomeUntil } = usePhoneSession();
  const reduceMotion = useSystemReducedMotion();
  const token = sessionToken;
  const room = useRoomClient();
  const rosterAnswer = room.useView('roster', token);
  const roster = useMemo(() => rosterAnswer ?? [], [rosterAnswer]);
  const running = room.useView('running', token);
  const seat = room.useView('session', token);
  const browsingAt = room.useView('browsing', token);
  const setupDraft = room.useView('setup', token);
  const standing = lobbyStanding(roster, session.playerId);
  const [pickerOpen, setPickerOpen] = useState(() => setupDraft !== null && setupDraft !== undefined);
  const action = useRoomAction(token);
  const { run, confirm, setFailure, setSuccess, dismissConfirmation } = action;
  const [managedPlayer, setManagedPlayer] = useState<RosterSeat>();
  const seatLossReported = useRef(false);

  useEffect(() => {
    if (seatLossReported.current || seat === undefined || seat !== null) return;
    seatLossReported.current = true;
    onSeatLost(seatLossNotice(roster));
  }, [onSeatLost, roster, seat]);

  const hostSeat = roster.find((candidate) => candidate.host);
  const previousHostId = useRef<string | undefined>(undefined);
  useEffect(() => {
    const hostId = hostSeat === undefined ? undefined : String(hostSeat.playerId);
    const before = previousHostId.current;
    previousHostId.current = hostId;
    if (before === undefined || hostId === undefined || before === hostId || hostSeat === undefined) return;
    setSuccess(hostSeat.playerId === session.playerId ? 'You’re the host now.' : `${hostSeat.nickname} is now the host.`);
  }, [hostSeat, session.playerId, setSuccess]);

  const [pickerSource, setPickerSource] = useState({ browsingAt, setupDraft });
  if (pickerSource.browsingAt !== browsingAt || pickerSource.setupDraft !== setupDraft) {
    setPickerSource({ browsingAt, setupDraft });
    if (setupDraft !== null && setupDraft !== undefined) setPickerOpen(true);
    else if (browsingAt === null) setPickerOpen(false);
  }

  const screen = runningGameScreen(running);
  const playerIds = useMemo(() => rosterAnswer?.map((player) => String(player.playerId)), [rosterAnswer]);
  const moments = useRoomMoments({ playerIds, runtime: screen.kind,
    lobbyResolved: running !== undefined && screen.kind === 'lobby' && browsingAt === null && setupDraft === null,
    browsing: browsingAt !== undefined && browsingAt !== null,
  });
  const installedOrSelectedModule = setupDraft === null || setupDraft === undefined
    ? undefined
    : GAME_REGISTRY.find((module) => module.metadata.id === setupDraft.gameId);
  const hostPicker = standing.youAreHost && screen.kind === 'lobby' && pickerVisibility({
    youAreHost: true,
    pickerOpen,
    browsingAt,
    hasSetup: setupDraft !== null && setupDraft !== undefined,
  });
  const guestPicker = !standing.youAreHost && screen.kind === 'lobby' && pickerVisibility({
    youAreHost: false,
    pickerOpen: false,
    browsingAt,
    hasSetup: setupDraft !== null && setupDraft !== undefined,
  });

  function confirmLeave() {
    confirm({
      title: 'Leave the room?',
      message: 'You can rejoin with the same code while the room is open.',
      confirmLabel: 'Leave',
      destructive: true,
      action: 'leave',
      onConfirm: () => {
        void (async () => {
          const didLeave = await run('leave', async () => {
            beginLeave();
            try {
              await room.command('leaveRoom', token as string, {});
              await onLeft();
            } catch (error) {
              cancelLeave();
              throw error;
            }
          });
          if (didLeave) dismissConfirmation();
        })();
      },
    });
  }

  function confirmTransfer(target: RosterSeat) {
    setManagedPlayer(undefined);
    confirm({
      title: `Make ${target.nickname} host?`,
      message: 'They will run the room from their phone.',
      confirmLabel: 'Make host',
      action: 'transfer',
      onConfirm: () => {
        void (async () => {
          const didTransfer = await run('transfer', () => room.command('transferHost', token as string, { playerId: target.playerId }), hostControlFailureMessage);
          if (didTransfer) {
            dismissConfirmation();
            setSuccess(`${target.nickname} is now the host.`);
          }
        })();
      },
    });
  }

  function confirmRemove(target: RosterSeat) {
    setManagedPlayer(undefined);
    confirm({
      title: `Remove ${target.nickname}?`,
      message: 'They will leave this room and can rejoin with a new seat.',
      confirmLabel: 'Remove',
      destructive: true,
      action: 'remove',
      onConfirm: () => {
        void (async () => {
          const didRemove = await run('remove', () => room.command('removePlayer', token as string, { playerId: target.playerId }), hostControlFailureMessage);
          if (didRemove) {
            dismissConfirmation();
            setSuccess(`${target.nickname} was removed from the room.`);
          }
        })();
      },
    });
  }

  const game = useGameActions({
    token,
    playerId: session.playerId,
    youAreHost: standing.youAreHost,
    browsingAt,
    setupDraft,
    finished: screen.kind === 'finished',
    action,
    setPickerOpen,
  });

  function managePlayer(target: RosterSeat) {
    if (!standing.youAreHost || target.host) return;
    setFailure(undefined);
    setManagedPlayer(target);
  }

  return {
    returned: moments.returned,
    welcoming: joinWelcomeUntil !== undefined,
    session,
    reduceMotion,
    roster,
    running,
    browsingAt,
    setupDraft,
    standing,
    screen,
    installedOrSelectedModule,
    hostPicker,
    guestPicker,
    busy: action.busy,
    failure: action.failure,
    success: action.success,
    confirmation: action.confirmation,
    managedPlayer,
    dismissConfirmation,
    dismissManagedPlayer: () => setManagedPlayer(undefined),
    confirmLeave,
    confirmTransfer,
    confirmRemove,
    ...game,
    managePlayer,
  };
}
