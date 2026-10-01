import { useRoomMoments } from '@huddle/ui/native';
import { api } from '@huddle/convex';
import type { GameEvent, GameModule, GameSettings, GameSettingsMode } from '@huddle/domain';
import { CAROUSEL_REGISTRY, runningGameScreen } from '@huddle/game-registry';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  hostControlFailureMessage,
  lobbyStanding,
  seatLossNotice,
  type RosterSeat,
} from '../features/room';
import { lifecycleFailureMessage } from '../models/lifecycle-rejection';
import { useHeartbeat } from '../platform/presence/native';
import { usePhoneSession, type PlayerSession } from '../platform/session';
import { usePhoneReducedMotion } from '../ui/reduced-motion';
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

/**
 * Everything a seated phone knows and can do: the room's live projections,
 * the action busy/failure state, and every Host and player action. Screens
 * render what this returns and call its actions; none of them talk to Convex.
 */
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
  const reduceMotion = usePhoneReducedMotion();
  const token = sessionToken;
  const rosterAnswer = useQuery(api.players.roster, { roomId: session.roomId });
  const roster = useMemo(() => rosterAnswer ?? [], [rosterAnswer]);
  const running = useQuery(
    api.games.running,
    token === undefined ? 'skip' : { roomId: session.roomId, sessionToken: token },
  );
  const seat = useQuery(
    api.players.session,
    token === undefined ? 'skip' : { sessionToken: token },
  );
  const browsingAt = useQuery(api.games.browsing, { roomId: session.roomId });
  const setupDraft = useQuery(api.games.setup, { roomId: session.roomId });
  const standing = lobbyStanding(roster, session.playerId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [failure, setFailure] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [managedPlayer, setManagedPlayer] = useState<RosterSeat>();
  const busyRef = useRef<BusyAction>(null);
  const seatLossReported = useRef(false);

  const leaveRoom = useMutation(api.players.leaveRoom);
  const transferHost = useMutation(api.players.transferHost);
  const removePlayer = useMutation(api.players.removePlayer);
  const browseGame = useMutation(api.games.browseGame);
  const selectGame = useMutation(api.games.selectGame);
  const configureGame = useMutation(api.games.configureGame);
  const finalizeGameSetup = useMutation(api.games.finalizeGameSetup);
  const reopenGameSetup = useMutation(api.games.reopenGameSetup);
  const cancelGameSetup = useMutation(api.games.cancelGameSetup);
  const setGameReady = useMutation(api.games.setGameReady);
  const startCountdown = useMutation(api.games.startCountdown);
  const stopCountdown = useMutation(api.games.stopCountdown);
  const endGame = useMutation(api.games.endGame);
  const continueAfterDisconnect = useMutation(api.games.continueAfterDisconnect);
  const sendEvent = useMutation(api.games.sendEvent);

  useEffect(() => {
    if (seatLossReported.current || seat === undefined || seat !== null) return;
    seatLossReported.current = true;
    onSeatLost(seatLossNotice(roster));
  }, [onSeatLost, roster, seat]);

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

    // A setup draft makes the shared picker visible on every phone, including
    // a guest that may later become Host. Once the authoritative projections
    // both say the room is back in its lobby, retire that historical local
    // optimism so a Host promotion cannot resurrect the old picker.
    // Deliberate `openPicker` optimism is preserved: this effect only reruns
    // when one of the server projections changes, not on the local state flip.
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
    : CAROUSEL_REGISTRY.find((module) => module.metadata.id === setupDraft.gameId);
  // Once browsing has begun it is shared room state. Keep the Host on the
  // picker after a remount as well as while the local browse mutation settles;
  // the Host's explicit Back-to-room action clears that shared index.
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
    // State updates are batched until this event yields. The ref closes the
    // same-tick double-tap window that a visible `busy` state alone leaves.
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
            // Mark intent before the mutation can publish a null seat. That
            // subscription update is an expected Leave, not a Host removal.
            beginLeave();
            try {
              await leaveRoom({ sessionToken: token as string });
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
          const didTransfer = await runAction('transfer', () => transferHost({ sessionToken: token as string, playerId: target.playerId }), hostControlFailureMessage);
          if (didTransfer) {
            setConfirmation(undefined);
            setSuccess(`${target.nickname} is now the Host.`);
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
          const didRemove = await runAction('remove', () => removePlayer({ sessionToken: token as string, playerId: target.playerId }), hostControlFailureMessage);
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
      await runAction('browse', () => browseGame({ sessionToken: token, index }));
      // The room's browse projection, not this optimistic flag, decides
      // whether everyone entered the carousel. A TV-away no-op therefore
      // returns the Host to the same room surface as everyone else.
      setPickerOpen(false);
    })();
  }

  function browse(index: number) {
    if (!standing.youAreHost || token === undefined) return;
    void runAction('browse', () => browseGame({ sessionToken: token, index }));
  }

  function chooseGame(module: GameModule) {
    if (!standing.youAreHost || module.placeholder || token === undefined) return;
    void runAction('select', () => selectGame({ sessionToken: token, gameId: module.metadata.id, mode: 'standard' }));
  }

  function configure(mode: GameSettingsMode, settings: GameSettings) {
    if (!standing.youAreHost || token === undefined || setupDraft === null || setupDraft === undefined) return;
    void runAction('configure', () => configureGame({ sessionToken: token, gameId: setupDraft.gameId, settings: { ...settings }, mode }));
  }

  function finalize() {
    if (!standing.youAreHost || token === undefined) return;
    void runAction('finalize', () => finalizeGameSetup({ sessionToken: token }));
  }

  function reopen() {
    if (!standing.youAreHost || token === undefined) return;
    void runAction('reopen', () => reopenGameSetup({ sessionToken: token }));
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
          const didReturn = await runAction('cancel', () => cancelGameSetup({ sessionToken: token }));
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
    void runAction('ready', () => setGameReady({ sessionToken: token, ready: !ready }));
  }

  function start() {
    if (!standing.youAreHost || token === undefined) return;
    void runAction('start', () => startCountdown({ sessionToken: token }));
  }

  function stopTheCountdown() {
    if (!standing.youAreHost || token === undefined) return;
    void runAction('stop', () => stopCountdown({ sessionToken: token }));
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
          const didEnd = await runAction('end', () => endGame({ sessionToken: token }));
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
    void runAction('continue', () => continueAfterDisconnect({ sessionToken: token }));
  }

  function event(event: GameEvent) {
    if (token === undefined || busy !== null) return;
    void runAction('event', () => sendEvent({ sessionToken: token, event }));
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

export type SeatedRoom = ReturnType<typeof useSeatedRoom>;
