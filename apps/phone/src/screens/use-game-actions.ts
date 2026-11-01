import type { GameEvent, GameModule, GameSettings, GameSettingsMode } from '@huddle/domain';

import type { RoomViews } from '../platform/room-client';
import { useRoomClient } from '../platform/room-client/native';
import type { RoomAction } from './use-room-action';

export function useGameActions({
  token,
  playerId,
  youAreHost,
  browsingAt,
  setupDraft,
  finished,
  action,
  setPickerOpen,
}: {
  readonly token: string | undefined;
  readonly playerId: string;
  readonly youAreHost: boolean;
  readonly browsingAt: RoomViews['browsing'] | undefined;
  readonly setupDraft: RoomViews['setup'] | undefined;
  readonly finished: boolean;
  readonly action: RoomAction;
  readonly setPickerOpen: (open: boolean) => void;
}) {
  const room = useRoomClient();
  const { run, confirm, dismissConfirmation } = action;
  const hostToken = youAreHost ? token : undefined;

  function openPicker() {
    if (hostToken === undefined) return;
    setPickerOpen(true);
    const index = browsingAt ?? 0;
    void (async () => {
      await run('browse', () => room.command('browseGame', hostToken, { index }));
      setPickerOpen(false);
    })();
  }

  function browse(index: number) {
    if (hostToken === undefined) return;
    void run('browse', () => room.command('browseGame', hostToken, { index }));
  }

  function chooseGame(module: GameModule) {
    if (hostToken === undefined) return;
    void run('select', () => room.command('selectGame', hostToken, { gameId: module.metadata.id, mode: 'standard' }));
  }

  function configure(mode: GameSettingsMode, settings: GameSettings) {
    if (hostToken === undefined || setupDraft === null || setupDraft === undefined) return;
    void run('configure', () => room.command('configureGame', hostToken, { gameId: setupDraft.gameId, settings: { ...settings }, mode }));
  }

  function finalize() {
    if (hostToken === undefined) return;
    void run('finalize', () => room.command('finalizeGameSetup', hostToken, {}));
  }

  function reopen() {
    if (hostToken === undefined) return;
    void run('reopen', () => room.command('reopenGameSetup', hostToken, {}));
  }

  function confirmReturnToRoom(hasDraft: boolean) {
    if (hostToken === undefined) return;
    confirm({
      title: 'Back to the room?',
      message: hasDraft
        ? 'This clears the unfinished setup for everyone. You can choose it again anytime.'
        : 'This closes game browsing for everyone. You can choose again anytime.',
      confirmLabel: 'Back to room',
      action: 'cancel',
      onConfirm: () => {
        void (async () => {
          if (await run('cancel', () => room.command('cancelGameSetup', hostToken, {}))) {
            setPickerOpen(false);
            dismissConfirmation();
          }
        })();
      },
    });
  }

  function toggleReady() {
    if (token === undefined || setupDraft === null || setupDraft === undefined) return;
    const ready = setupDraft.readyPlayerIds.includes(playerId);
    void run('ready', () => room.command('setGameReady', token, { ready: !ready }));
  }

  function start() {
    if (hostToken === undefined) return;
    void run('start', () => room.command('startCountdown', hostToken, {}));
  }

  function stopCountdown() {
    if (hostToken === undefined) return;
    void run('stop', () => room.command('stopCountdown', hostToken, {}));
  }

  function end() {
    if (hostToken === undefined) return;
    confirm({
      title: 'Back to the room?',
      message: finished ? 'Everyone goes back to the room to choose the next game.' : 'This ends the current game for everyone.',
      confirmLabel: 'Back to room',
      destructive: !finished,
      action: 'end',
      onConfirm: () => {
        void (async () => {
          if (await run('end', () => room.command('endGame', hostToken, {}))) {
            setPickerOpen(false);
            dismissConfirmation();
          }
        })();
      },
    });
  }

  function continueGame() {
    if (hostToken === undefined) return;
    void run('continue', () => room.command('continueAfterDisconnect', hostToken, {}));
  }

  function event(event: GameEvent) {
    if (token === undefined || action.busy !== null) return;
    void run('event', () => room.command('sendEvent', token, { event }));
  }

  return { openPicker, browse, chooseGame, configure, finalize, reopen, confirmReturnToRoom, toggleReady, start, stopCountdown, end, continueGame, event };
}
