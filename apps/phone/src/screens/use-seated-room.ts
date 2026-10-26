import { useRoomMoments, useSystemReducedMotion } from '@huddle/ui/native';
import type { GameEvent, GameModule, GameSettings, GameSettingsMode } from '@huddle/domain';
import { GAME_REGISTRY, runningGameScreen } from '@huddle/game-registry';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  hostControlFailureMessage,
  lobbyStanding,
  seatLossNotice,
  type RosterSeat,
} from '../features/room';
import { lifecycleFailureMessage } from '../models/lifecycle-rejection';
import { useHeartbeat } from '../platform/presence/native';
import { useRoomClient } from '../platform/room-client/native';
import { usePhoneSession, type PlayerSession } from '../platform/session';
import { pickerVisibility } from './seated-phone-model';

export type BusyAction =
  | 'leave'
  | 'transfer'
  | 'remove'
  | 'browse'
  | 'select'
  | 'configure'
  | 'finalize'
  | 'reopen'
  | 'cancel'
  | 'ready'
  | 'start'
  | 'stop'
  | 'end'
  | 'continue'
  | 'event'
  | null;

export type Confirmation = {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly destructive?: boolean;
  readonly action: Exclude<BusyAction, null>;
  readonly onConfirm: () => void;
};

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [failure, setFailure] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [confirmation, setConfirmation] = useState<Confirmation>();
  useFocusEffect(useCallback(() => () => setConfirmation(undefined), []));
  const [managedPlayer, setManagedPlayer] = useState<RosterSeat>();
  const busyRef = useRef<BusyAction>(null);
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
  }, [hostSeat, session.playerId]);

  useEffect(() => {
    if (success === undefined) return;
    const timeout = setTimeout(() => setSuccess(undefined), 2600);
    return () => clearTimeout(timeout);
  }, [success]);

  useEffect(() => {
    if (setupDraft !== null && setupDraft !== undefined) {
      setPickerOpen(true);
      return;
    }

    if (browsingAt === null) setPickerOpen(false);
  }, [browsingAt, setupDraft]);

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

  async function runAction(action: Exclude<BusyAction, null>, callback: () => Promise<unknown>, message = lifecycleFailureMessage) {
    if (busyRef.current !== null || token === undefined) return false;
    busyRef.current = action;
    setBusy(action);
    setFailure(undefined);
    setSuccess(undefined);
    try {
      await callback();
      return true;
    } catch (error) {
      setFailure(message(error));
      return false;
    } finally {
      busyRef.current = null;
      setBusy(null);
    }
  }

  function confirmLeave() {
    setFailure(undefined);
    setConfirmation({
      title: 'Leave the room?',
      message: 'You can rejoin with the same code while the room is open.',
      confirmLabel: 'Leave',
      destructive: true,
      action: 'leave',
      onConfirm: () => {
        void (async () => {
          const didLeave = await runAction('leave', async () => {
            beginLeave();
            try {
              await room.command('leaveRoom', token as string, {});
              await onLeft();
            } catch (error) {
              cancelLeave();
              throw error;
            }
          });
          if (didLeave) setConfirmation(undefined);
        })();
      },
    });
  }

  function confirmTransfer(target: RosterSeat) {
    setFailure(undefined);
    setManagedPlayer(undefined);
    setConfirmation({
      title: `Make ${target.nickname} host?`,
      message: 'They will run the room from their phone.',
      confirmLabel: 'Make host',
      action: 'transfer',
      onConfirm: () => {
        void (async () => {
          const didTransfer = await runAction('transfer', () => room.command('transferHost', token as string, { playerId: target.playerId }), hostControlFailureMessage);
          if (didTransfer) {
            setConfirmation(undefined);
            setSuccess(`${target.nickname} is now the host.`);
          }
        })();
      },
    });
  }

  function confirmRemove(target: RosterSeat) {
    setFailure(undefined);
    setManagedPlayer(undefined);
    setConfirmation({
      title: `Remove ${target.nickname}?`,
      message: 'They will leave this room and can rejoin with a new seat.',
      confirmLabel: 'Remove',
      destructive: true,
      action: 'remove',
      onConfirm: () => {
        void (async () => {
          const didRemove = await runAction('remove', () => room.command('removePlayer', token as string, { playerId: target.playerId }), hostControlFailureMessage);
          if (didRemove) {
            setConfirmation(undefined);
            setSuccess(`${target.nickname} was removed from the room.`);
          }
        })();
      },
    });
  }

  function openPicker() {
    if (!standing.youAreHost || token === undefined) return;
    setPickerOpen(true);
    const index = browsingAt ?? 0;
    void (async () => {
      await runAction('browse', () => room.command('browseGame', token, { index }));
      setPickerOpen(false);
    })();
  }

  function browse(index: number) {
    if (!standing.youAreHost || token === undefined) return;
    void runAction('browse', () => room.command('browseGame', token, { index }));
  }

  function chooseGame(module: GameModule) {
    if (!standing.youAreHost || token === undefined) return;
    void runAction('select', () => room.command('selectGame', token, { gameId: module.metadata.id, mode: 'standard' }));
  }

  function configure(mode: GameSettingsMode, settings: GameSettings) {
    if (!standing.youAreHost || token === undefined || setupDraft === null || setupDraft === undefined) return;
    void runAction('configure', () => room.command('configureGame', token, { gameId: setupDraft.gameId, settings: { ...settings }, mode }));
  }

  function finalize() {
    if (!standing.youAreHost || token === undefined) return;
    void runAction('finalize', () => room.command('finalizeGameSetup', token, {}));
  }

  function reopen() {
    if (!standing.youAreHost || token === undefined) return;
    void runAction('reopen', () => room.command('reopenGameSetup', token, {}));
  }

  function confirmReturnToRoom(hasDraft: boolean) {
    if (!standing.youAreHost || token === undefined) return;
    setFailure(undefined);
    setConfirmation({
      title: 'Back to the room?',
      message: hasDraft
        ? 'This clears the unfinished setup for everyone. You can choose it again anytime.'
        : 'This closes game browsing for everyone. You can choose again anytime.',
      confirmLabel: 'Back to room',
      action: 'cancel',
      onConfirm: () => {
        void (async () => {
          const didReturn = await runAction('cancel', () => room.command('cancelGameSetup', token, {}));
          if (didReturn) {
            setPickerOpen(false);
            setConfirmation(undefined);
          }
        })();
      },
    });
  }

  function toggleReady() {
    if (token === undefined || setupDraft === null || setupDraft === undefined) return;
    const ready = setupDraft.readyPlayerIds.includes(session.playerId);
    void runAction('ready', () => room.command('setGameReady', token, { ready: !ready }));
  }

  function start() {
    if (!standing.youAreHost || token === undefined) return;
    void runAction('start', () => room.command('startCountdown', token, {}));
  }

  function stopTheCountdown() {
    if (!standing.youAreHost || token === undefined) return;
    void runAction('stop', () => room.command('stopCountdown', token, {}));
  }

  function end() {
    if (!standing.youAreHost || token === undefined) return;
    setFailure(undefined);
    setConfirmation({
      title: 'Back to the room?',
      message: screen.kind === 'finished'
        ? 'Everyone goes back to the room to choose the next game.'
        : 'This ends the current game for everyone.',
      confirmLabel: 'Back to room',
      destructive: screen.kind !== 'finished',
      action: 'end',
      onConfirm: () => {
        void (async () => {
          const didEnd = await runAction('end', () => room.command('endGame', token, {}));
          if (didEnd) {
            setPickerOpen(false);
            setConfirmation(undefined);
          }
        })();
      },
    });
  }

  function continueGame() {
    if (!standing.youAreHost || token === undefined) return;
    void runAction('continue', () => room.command('continueAfterDisconnect', token, {}));
  }

  function event(event: GameEvent) {
    if (token === undefined || busy !== null) return;
    void runAction('event', () => room.command('sendEvent', token, { event }));
  }

  function managePlayer(target: RosterSeat) {
    if (!standing.youAreHost || target.host) return;
    setFailure(undefined);
    setManagedPlayer(target);
  }

  return {
    returned: moments.returned,
    welcoming: joinWelcomeUntil !== undefined && joinWelcomeUntil > Date.now(),
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
    busy,
    failure,
    success,
    confirmation,
    managedPlayer,
    dismissConfirmation: () => setConfirmation(undefined),
    dismissManagedPlayer: () => setManagedPlayer(undefined),
    confirmLeave,
    confirmTransfer,
    confirmRemove,
    openPicker,
    browse,
    chooseGame,
    configure,
    finalize,
    reopen,
    confirmReturnToRoom,
    toggleReady,
    start,
    stopCountdown: stopTheCountdown,
    end,
    continueGame,
    event,
    managePlayer,
  };
}
