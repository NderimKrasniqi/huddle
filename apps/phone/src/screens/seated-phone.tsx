import { api } from '@huddle/convex';
import { ROOM_PLAYER_CAP } from '@huddle/domain';
import type {
  GameEvent,
  GameModule,
  GamePlayer,
  GameSettings,
  GameSettingsMode,
  GameSetting,
} from '@huddle/domain';
import { radii, semanticColors, shadows, spacing } from '@huddle/design-tokens';
import {
  CAROUSEL_REGISTRY,
  carouselWindow,
  nextIndex,
  previousIndex,
  runningGameScreen,
  type RunningGameScreen,
} from '@huddle/game-registry';
import {
  Badge,
  Chip,
  CodeTiles,
  GameCard,
  HuddleButton,
  HuddleText,
  HEARTBEAT_ARTWORK,
  PlayerRow,
  ScreenShell,
} from '@huddle/ui/native';
import { useMutation, useQuery } from 'convex/react';
import { Image, ImageBackground, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  hostControlFailureMessage,
  lobbyStanding,
  rosterRowControls,
  seatLossNotice,
  type RosterSeat,
} from '../features/room';
import { settingsControls } from '../features/game-picker/settings-choice';
import { lifecycleFailureMessage } from '../models/lifecycle-rejection';
import { useHeartbeat } from '../platform/presence/native';
import { usePhoneSession, type PlayerSession } from '../platform/session';
import { usePhoneReducedMotion } from '../ui/reduced-motion';
import { PhoneLoadingScreen } from '../ui/native';
import { pickerControlState, pickerVisibility, setupModeLabel, setupReadiness } from './seated-phone-model';

const GAME_ART = {
  trivia: HEARTBEAT_ARTWORK.gameCards.trivia,
  voting: HEARTBEAT_ARTWORK.gameCards.voting,
  'doodle-dash': HEARTBEAT_ARTWORK.gameCards.doodleDash,
  'quick-poll': HEARTBEAT_ARTWORK.gameCards.quickPoll,
  'hot-take': HEARTBEAT_ARTWORK.gameCards.hotTake,
} as const;

const GAME_TONES = {
  trivia: 'trivia',
  voting: 'voting',
  'doodle-dash': 'doodleDash',
  'quick-poll': 'quickPoll',
  'hot-take': 'hotTake',
} as const;

type BusyAction =
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
  | 'end'
  | 'continue'
  | 'event'
  | null;

type Confirmation = {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly destructive?: boolean;
  readonly action: Exclude<BusyAction, null>;
  readonly onConfirm: () => void;
};

export function SeatedPhone({
  session,
  onSeatLost,
  onLeft,
}: {
  readonly session: PlayerSession;
  readonly onSeatLost: (reason: string) => void;
  readonly onLeft: () => void | Promise<void>;
}) {
  useHeartbeat();
  const { beginLeave, cancelLeave, sessionToken } = usePhoneSession();
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
  const startGame = useMutation(api.games.startGame);
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
    void runAction('start', () => startGame({ sessionToken: token }));
  }

  function end() {
    if (!standing.youAreHost || token === undefined) return;
    setFailure(undefined);
    setConfirmation({
      title: 'Back to the room?',
      message: 'This ends the current game for everyone.',
      confirmLabel: 'Back to room',
      destructive: true,
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
        onBackToLobby={end}
        onEvent={event}
      />
      <ConfirmationSheet confirmation={confirmation} busy={busy} failure={failure} reduceMotion={reduceMotion} onCancel={() => setConfirmation(undefined)} />
      </>
    );
  }

  if (screen.kind === 'paused') {
    return (
      <>
      <PhoneRuntimeStatus
        variant="paused"
        title="Game is paused"
        message={screen.reason === 'playerDisconnected' ? 'A player’s phone went quiet. The room will resume when everyone is back.' : 'The TV is reconnecting. Keep Huddle open on the phones.'}
        youAreHost={standing.youAreHost}
        failure={failure}
        busy={busy}
        primary={screen.reason === 'playerDisconnected' ? { label: 'Continue without waiting', onPress: continueGame, disabled: false, action: 'continue' } : undefined}
        onBackToLobby={end}
      />
      <ConfirmationSheet confirmation={confirmation} busy={busy} failure={failure} reduceMotion={reduceMotion} onCancel={() => setConfirmation(undefined)} />
      </>
    );
  }

  if (screen.kind === 'unavailable') {
    return (
      <>
      <PhoneRuntimeStatus
        variant="unavailable"
        title="Game unavailable"
        message="This game could not be restored on this phone. The Host can return the room to the lobby."
        youAreHost={standing.youAreHost}
        failure={failure}
        busy={busy}
        onBackToLobby={end}
      />
      <ConfirmationSheet confirmation={confirmation} busy={busy} failure={failure} reduceMotion={reduceMotion} onCancel={() => setConfirmation(undefined)} />
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
        <SetupSurface
          module={installedOrSelectedModule}
          setup={setupDraft}
          roster={roster}
          playerId={session.playerId}
          youAreHost={standing.youAreHost}
          busy={busy}
          failure={failure}
          onConfigure={configure}
          onFinalize={finalize}
          onReopen={reopen}
          onCancel={() => confirmReturnToRoom(true)}
          onReady={toggleReady}
          onStart={start}
          onLeave={confirmLeave}
        />
        <ConfirmationSheet confirmation={confirmation} busy={busy} failure={failure} reduceMotion={reduceMotion} onCancel={() => setConfirmation(undefined)} />
        </>
      );
    }
    return (
      <>
        <PickerSurface
          browsingAt={browsingAt ?? 0}
          youAreHost={standing.youAreHost}
          hostNickname={standing.hostNickname}
          busy={busy}
          failure={failure}
          onBrowse={browse}
          onChoose={chooseGame}
          onBackToRoom={() => confirmReturnToRoom(false)}
          onLeave={confirmLeave}
        />
      <ConfirmationSheet confirmation={confirmation} busy={busy} failure={failure} reduceMotion={reduceMotion} onCancel={() => setConfirmation(undefined)} />
      </>
    );
  }

  return (
    <>
    <LobbySurface
      session={session}
      roster={roster}
      standing={standing}
      busy={busy}
      failure={failure}
      success={success}
      onOpenPicker={openPicker}
      onManage={managePlayer}
      onLeave={confirmLeave}
      />
      <ConfirmationSheet confirmation={confirmation} busy={busy} failure={failure} reduceMotion={reduceMotion} onCancel={() => setConfirmation(undefined)} />
      <PlayerManagementSheet
        player={managedPlayer}
        busy={busy}
        onDismiss={() => setManagedPlayer(undefined)}
        onTransfer={confirmTransfer}
        onRemove={confirmRemove}
      />
    </>
  );
}

function LobbySurface({
  session,
  roster,
  standing,
  busy,
  failure,
  success,
  onOpenPicker,
  onManage,
  onLeave,
}: {
  readonly session: PlayerSession;
  readonly roster: readonly RosterSeat[];
  readonly standing: ReturnType<typeof lobbyStanding>;
  readonly busy: BusyAction;
  readonly failure?: string;
  readonly success?: string;
  readonly onOpenPicker: () => void;
  readonly onManage: (seat: RosterSeat) => void;
  readonly onLeave: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScreenShell tone="background" style={styles.shell} testID="phone-lobby">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.page, { flexGrow: 1, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.roomNav}>
            <View style={styles.navButton} />
            <HuddleText variant="bodyLarge" style={styles.navTitle}>Room</HuddleText>
            <View style={styles.navButton} />
          </View>

          <View style={styles.roomSummary}>
            <HuddleText variant="caption" style={styles.roomLabel}>ROOM CODE</HuddleText>
            <CodeTiles code={session.code} testID="phone-room-code-tiles" accessibilityLabel={`Room code ${session.code}`} />
            <Badge label={standing.youAreHost ? 'Host' : 'You'} tone={standing.youAreHost ? 'host' : 'neutral'} />
          </View>

          <View style={styles.rosterSection}>
            <View style={styles.sectionHeading}>
              <HuddleText variant="title">Players</HuddleText>
              <HuddleText variant="caption" style={styles.helper}>{roster.length} / {ROOM_PLAYER_CAP} players</HuddleText>
            </View>
            <View style={styles.rosterList}>
              {roster.map((seat) => {
                const manageable = standing.youAreHost && !seat.host;
                const row = (
                  <PlayerRow
                    displayName={seat.nickname}
                    avatarId={seat.avatar}
                    status={seat.away ? 'away' : 'waiting'}
                    isHost={seat.host}
                    testID={`lobby-player-${seat.playerId}`}
                    style={styles.lobbyPlayerRow}
                  />
                );
                return manageable ? (
                  <Pressable
                    key={seat.playerId}
                    onPress={() => onManage(seat)}
                    accessibilityRole="button"
                    accessibilityLabel={`Manage ${seat.nickname}`}
                    accessibilityHint="Opens player actions"
                    testID={`manage-player-${seat.playerId}`}
                  >
                    {row}
                  </Pressable>
                ) : (
                  <View key={seat.playerId}>{row}</View>
                );
              })}
            </View>
          </View>

          {failure ? <HuddleText variant="caption" align="center" accessibilityRole="alert" testID="phone-lifecycle-error">{failure}</HuddleText> : null}
          {success ? (
            <View style={styles.successBanner} accessible accessibilityRole="alert" accessibilityLiveRegion="polite" testID="phone-lifecycle-success">
              <HuddleText variant="body" align="center">{success}</HuddleText>
            </View>
          ) : null}
          {standing.youAreHost ? (
            <View style={styles.bottomActions}>
              <HuddleButton title="Leave" variant="secondary" onPress={onLeave} busy={busy === 'leave'} accessibilityLabel="Leave room" testID="leave-room" style={styles.bottomAction} />
              <HuddleButton title="Pick a game" onPress={onOpenPicker} busy={busy === 'browse'} accessibilityLabel="Pick a game" testID="open-game-picker" style={[styles.bottomAction, styles.primaryAction]} />
            </View>
          ) : (
            <>
              <View style={styles.hostWaitingPanel}>
                <HuddleText variant="bodyLarge" align="center">Waiting for {standing.hostNickname ?? 'the Host'}</HuddleText>
                <HuddleText variant="caption" align="center">They’ll choose a game for the room.</HuddleText>
              </View>
              <HuddleButton title="Leave" variant="secondary" onPress={onLeave} busy={busy === 'leave'} accessibilityLabel="Leave room" testID="leave-room" style={styles.leaveAction} />
            </>
          )}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

function PlayerManagementSheet({
  player,
  busy,
  onDismiss,
  onTransfer,
  onRemove,
}: {
  readonly player: RosterSeat | undefined;
  readonly busy: BusyAction;
  readonly onDismiss: () => void;
  readonly onTransfer: (seat: RosterSeat) => void;
  readonly onRemove: (seat: RosterSeat) => void;
}) {
  const insets = useSafeAreaInsets();
  if (player === undefined) return null;
  const controls = rosterRowControls(player);
  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      accessibilityViewIsModal
      testID="player-management-modal"
    >
      <View style={[styles.confirmationScrim, { paddingBottom: insets.bottom }]}>
        <View style={styles.managementSheet}>
          <View style={styles.sheetHandle} />
          <HuddleText variant="caption" style={styles.sheetEyebrow}>PLAYER</HuddleText>
          <PlayerRow
            displayName={player.nickname}
            avatarId={player.avatar}
            status={player.away ? 'away' : 'waiting'}
            testID="managed-player"
            style={styles.sheetPlayerRow}
          />
          {controls.map((control) => (
            <View key={control.action} style={styles.sheetActionBlock}>
              <HuddleButton
                title={control.label}
                variant={control.action === 'remove' ? 'destructive' : 'secondary'}
                disabled={!control.enabled}
                busy={busy === control.action}
                onPress={() => control.action === 'transfer' ? onTransfer(player) : onRemove(player)}
                accessibilityLabel={`${control.label} ${player.nickname}`}
                testID={`manage-${control.action}-${player.playerId}`}
                style={styles.sheetAction}
              />
              {control.disabledBecause ? <HuddleText variant="caption" align="center" style={styles.helper}>{control.disabledBecause}</HuddleText> : null}
            </View>
          ))}
          <HuddleButton title="Cancel" variant="ghost" onPress={onDismiss} disabled={busy !== null} accessibilityLabel="Cancel" testID="manage-cancel" style={styles.sheetAction} />
        </View>
      </View>
    </Modal>
  );
}

export function PickerSurface({
  browsingAt,
  youAreHost,
  hostNickname,
  busy,
  failure,
  onBrowse,
  onChoose,
  onBackToRoom,
  onLeave,
}: {
  readonly browsingAt: number;
  readonly youAreHost: boolean;
  readonly hostNickname?: string;
  readonly busy: BusyAction;
  readonly failure?: string;
  readonly onBrowse: (index: number) => void;
  readonly onChoose: (module: GameModule) => void;
  readonly onBackToRoom: () => void;
  readonly onLeave: () => void;
}) {
  const insets = useSafeAreaInsets();
  const window = carouselWindow(browsingAt);
  const selectedIndex = window?.index ?? 0;
  const focused = window?.focused;
  const [listMode, setListMode] = useState(false);
  const controls = pickerControlState({
    youAreHost,
    focusedPlaceholder: focused?.placeholder === true,
    busy: busy !== null,
  });
  const focusedId = focused?.metadata.id as keyof typeof GAME_ART | undefined;
  const isUpdatingTv = busy === 'browse' || busy === 'select';
  const lastCarouselIndex = Math.max(0, CAROUSEL_REGISTRY.length - 1);

  if (focused === undefined || focusedId === undefined) return null;

  const gameMetadata = [
    `${focused.metadata.playerRange.min}–${focused.metadata.playerRange.max} players`,
    `about ${focused.metadata.estimatedMinutes} min`,
    'all ages',
  ];

  function browseSelected() {
    if (controls.cardAction !== null) onBrowse(selectedIndex);
  }

  return (
    <ScreenShell tone="background" style={styles.shell} testID="phone-game-picker">
      <ScrollView contentContainerStyle={styles.scroll} horizontal={false} showsVerticalScrollIndicator={false}>
        <View style={[styles.page, styles.pickerPage, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.pickerNav}>
            {youAreHost ? (
              <Pressable onPress={onBackToRoom} accessibilityRole="button" accessibilityLabel="Back to room" testID="picker-back-top" style={styles.backLink}>
                <HuddleText variant="body" color="primary">‹&nbsp; Back to room</HuddleText>
              </Pressable>
            ) : <View style={styles.navButton} />}
            {youAreHost ? (
              <Pressable
                onPress={() => setListMode((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel={listMode ? 'Show game carousel' : 'Show game list'}
                testID="picker-view-toggle"
                style={styles.viewToggle}
              >
                <HuddleText variant="caption">{listMode ? 'Carousel' : 'List'}</HuddleText>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.pickerHeading}>
            <HuddleText variant="display" align="center">Pick a game</HuddleText>
            <HuddleText variant="bodyLarge" align="center">What are we feeling?</HuddleText>
          </View>

          {!youAreHost ? (
            <View style={styles.guestPickerSurface}>
              <Image source={HEARTBEAT_ARTWORK.phone.guestWaiting} resizeMode="cover" style={styles.guestWaitingArt} accessible={false} />
              <View style={styles.guestWaitingCopy}>
                <HuddleText variant="title" align="center">{hostNickname ?? 'The Host'} is choosing a game</HuddleText>
                <HuddleText variant="body" align="center">Hang tight! The fun’s coming.</HuddleText>
              </View>
              {/* Kept as a passive accessibility anchor for the shared selected game. */}
              <GameCard
                title={focused.metadata.title}
                description={focused.metadata.category}
                metadata={gameMetadata}
                image={GAME_ART[focusedId]}
                tone={GAME_TONES[focusedId]}
                selected
                disabled
                interactive={false}
                testID={`phone-game-card-${focused.metadata.id}`}
                style={styles.passivePickerAnchor}
              />
              <HuddleButton title="Leave room" variant="secondary" onPress={onLeave} accessibilityLabel="Leave room" testID="picker-leave" style={styles.fullWidthAction} />
            </View>
          ) : listMode ? (
            <View style={styles.gameList}>
              {CAROUSEL_REGISTRY.map((module, index) => {
                const id = module.metadata.id as keyof typeof GAME_ART;
                const cardLabel = `${module.metadata.title}${module.placeholder ? ', coming soon' : ''}`;
                return (
                  <Pressable
                    key={module.metadata.id}
                    onPress={() => onBrowse(index)}
                    disabled={busy !== null}
                    accessibilityRole="button"
                    accessibilityLabel={cardLabel}
                    accessibilityState={{ selected: index === selectedIndex, disabled: busy !== null || module.placeholder === true }}
                    testID={`phone-game-card-${module.metadata.id}`}
                    style={[styles.gameListRow, index === selectedIndex ? styles.gameListRowSelected : null, module.placeholder ? styles.gameListRowDisabled : null]}
                  >
                    <Image source={GAME_ART[id]} resizeMode="contain" style={styles.gameListArt} accessible={false} />
                    <View style={styles.gameListCopy}>
                      <HuddleText variant="bodyLarge">{module.metadata.title}</HuddleText>
                      <HuddleText variant="caption">{module.metadata.category}</HuddleText>
                      <HuddleText variant="caption" style={styles.helper}>{module.metadata.playerRange.min}–{module.metadata.playerRange.max} players&nbsp; · &nbsp;about {module.metadata.estimatedMinutes} min</HuddleText>
                    </View>
                    {module.placeholder ? <Badge label="Coming soon" tone="comingSoon" /> : <HuddleText variant="title" style={styles.listChevron}>›</HuddleText>}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <>
              <View style={styles.carouselStage}>
                <HuddleButton title="‹" variant="secondary" disabled={busy !== null} onPress={() => {
                  const previous = previousIndex(selectedIndex) ?? lastCarouselIndex;
                  onBrowse(previous);
                }} accessibilityLabel="Previous game" testID="picker-previous" style={styles.carouselArrow} />
                <GameCard
                  title={focused.metadata.title}
                  image={GAME_ART[focusedId]}
                  tone={GAME_TONES[focusedId]}
                  selected
                  comingSoon={focused.placeholder === true}
                  disabled={controls.cardAction === null}
                  interactive={controls.cardAction !== null}
                  onPress={browseSelected}
                  testID={`phone-game-card-${focused.metadata.id}`}
                  style={styles.focusedGameCard}
                />
                <HuddleButton title="›" variant="secondary" disabled={busy !== null} onPress={() => {
                  const next = nextIndex(selectedIndex) ?? 0;
                  onBrowse(next);
                }} accessibilityLabel="Next game" testID="picker-next" style={styles.carouselArrow} />
              </View>
              <HuddleText variant="caption" align="center" style={styles.pickerMetadata}>
                {gameMetadata.join(' • ')}
              </HuddleText>
              <View style={styles.carouselDots} accessibilityLabel={`Game ${selectedIndex + 1} of ${window?.total ?? CAROUSEL_REGISTRY.length}`}>
                {CAROUSEL_REGISTRY.map((module, index) => <View key={module.metadata.id} style={[styles.dot, index === selectedIndex ? styles.dotSelected : null]} />)}
              </View>
              {focused.placeholder ? <Badge label="Coming soon" tone="comingSoon" style={styles.comingSoonBadge} /> : null}
            </>
          )}

          {youAreHost && isUpdatingTv ? (
            <View style={styles.syncPanel} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="picker-syncing">
              <View style={styles.syncDots}>{[0, 1, 2, 3].map((dot) => <View key={dot} style={[styles.syncDot, dot === 0 ? styles.syncDotActive : null]} />)}</View>
              <View style={styles.syncCopy}>
                <HuddleText variant="bodyLarge">Showing {focused.metadata.title} on the TV…</HuddleText>
                <HuddleText variant="caption">This may take a few seconds.</HuddleText>
              </View>
            </View>
          ) : null}
          {failure ? <HuddleText variant="caption" align="center" accessibilityRole="alert" testID="picker-error">{failure}</HuddleText> : null}
          {failure && youAreHost ? <HuddleButton title="Try again" variant="primary" onPress={browseSelected} busy={busy === 'browse'} accessibilityLabel="Try again" testID="picker-retry" style={styles.fullWidthAction} /> : null}
          {youAreHost && !listMode ? focused.placeholder ? (
            <HuddleButton title={`Set up ${focused.metadata.title}`} disabled onPress={() => undefined} accessibilityLabel={`${focused.metadata.title}, coming soon`} testID="picker-coming-soon" style={styles.pickerPrimaryAction} />
          ) : (
            <HuddleButton title={`Set up ${focused.metadata.title}`} onPress={() => onChoose(focused)} busy={busy === 'select'} disabled={!controls.selectEnabled} accessibilityLabel={`Set up ${focused.metadata.title}`} testID="picker-select" style={styles.pickerPrimaryAction} />
          ) : null}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

export function SetupSurface({
  module,
  setup,
  roster,
  playerId,
  youAreHost,
  busy,
  failure,
  onConfigure,
  onFinalize,
  onReopen,
  onCancel,
  onReady,
  onStart,
  onLeave,
}: {
  readonly module: GameModule;
  readonly setup: {
    readonly gameId: string;
    readonly settings: Record<string, string>;
    readonly mode: GameSettingsMode;
    readonly stage: 'configuring' | 'ready';
    readonly readyPlayerIds: readonly string[];
  };
  readonly roster: readonly RosterSeat[];
  readonly playerId: string;
  readonly youAreHost: boolean;
  readonly busy: BusyAction;
  readonly failure?: string;
  readonly onConfigure: (mode: GameSettingsMode, settings: GameSettings) => void;
  readonly onFinalize: () => void;
  readonly onReopen: () => void;
  readonly onCancel: () => void;
  readonly onReady: () => void;
  readonly onStart: () => void;
  readonly onLeave: () => void;
}) {
  const insets = useSafeAreaInsets();
  const presentation = module.settingsPresentation;
  const selectedPreset = presentation?.presets?.find((preset) => preset.mode === setup.mode);
  const settings = setup.settings;
  const customControls = settingsControls(
    module.settingsSchema,
    setup.gameId,
    { gameId: setup.gameId, settings },
    presentation,
  );
  const readiness = setupReadiness({
    stage: setup.stage,
    playerRange: module.metadata.playerRange,
    roster,
    readyPlayerIds: setup.readyPlayerIds,
    playerId,
  });
  const { allReady, canStart, readyCount, currentReady } = readiness;
  const awayCount = roster.filter((seat) => seat.away).length;
  const countInRange = roster.length >= module.metadata.playerRange.min && roster.length <= module.metadata.playerRange.max;
  const readyStatus = awayCount > 0
    ? `${awayCount} player${awayCount === 1 ? '' : 's'} away. Waiting for them to reconnect.`
    : !countInRange
      ? `Need ${module.metadata.playerRange.min}–${module.metadata.playerRange.max} players to start.`
      : allReady
        ? 'Everyone is ready. The Host can start.'
        : 'Everyone here needs to tap Ready.';

  function defaultsFor(schema: readonly GameSetting[]): GameSettings {
    return Object.fromEntries(schema.map((setting) => [setting.key, settings[setting.key] ?? setting.defaultValue]));
  }

  function chooseMode(mode: GameSettingsMode) {
    const preset = presentation?.presets?.find((candidate) => candidate.mode === mode);
    onConfigure(mode, mode === 'custom' ? customSettings() : preset?.settings ?? defaultsFor(module.settingsSchema));
  }

  function chooseSetting(setting: GameSetting, value: string) {
    onConfigure('custom', { ...customSettings(), [setting.key]: value });
  }

  function customSettings(): GameSettings {
    return Object.fromEntries(module.settingsSchema.map((setting) => {
      const visible = presentation?.customSettingKeys === undefined || presentation.customSettingKeys.includes(setting.key);
      const allowed = presentation?.customOptions?.[setting.key];
      const options = allowed === undefined
        ? setting.options
        : setting.options.filter((option) => allowed.includes(option.value));
      const current = visible ? settings[setting.key] : undefined;
      const selected = current !== undefined && options.some((option) => option.value === current)
        ? current
        : options[0]?.value ?? setting.defaultValue;
      return [setting.key, selected];
    }));
  }

  return (
    <ScreenShell tone="background" style={styles.shell} testID="phone-game-setup">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.page, styles.setupPage, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.setupNav}>
            {youAreHost ? (
              <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="Back to room" testID="setup-nav-back" style={styles.backLink}>
                <HuddleText variant="body" color="primary">‹&nbsp; Back to room</HuddleText>
              </Pressable>
            ) : <View style={styles.navButton} />}
            <View style={styles.navButton} />
          </View>

          <View style={styles.setupHeading}>
            <Image source={HEARTBEAT_ARTWORK.brand.displayMark} resizeMode="contain" style={styles.setupBrandMark} accessible={false} testID="phone-game-setup-mark" />
            <HuddleText variant="title" align="center">{setup.stage === 'ready' ? `${module.metadata.title} setup` : `Set up ${module.metadata.title}`}</HuddleText>
            <HuddleText variant="caption" align="center">{setup.stage === 'ready' ? 'Get everyone ready to play.' : 'Choose a mode to get started.'}</HuddleText>
          </View>

          {setup.stage === 'configuring' ? (
            <>
              <View style={styles.setupPanel}>
                <View style={styles.modeRow}>
                  {(['quick', 'standard', 'custom'] as const).map((mode) => (
                    <Chip
                      key={mode}
                      label={setupModeLabel(mode)}
                      selected={setup.mode === mode}
                      disabled={!youAreHost}
                      onPress={() => chooseMode(mode)}
                      testID={`setup-mode-${mode}`}
                    />
                  ))}
                </View>
                {selectedPreset && setup.mode !== 'custom' ? (
                  <View style={styles.presetSummary} testID="setup-preset-summary">
                    <HuddleText variant="title" style={styles.presetTitle}>{selectedPreset.label}</HuddleText>
                    <View style={styles.presetLines}>
                      {module.settingsSchema.map((setting) => {
                        const value = selectedPreset.settings[setting.key] ?? setting.defaultValue;
                        const label = setting.options.find((option) => option.value === value)?.label ?? value;
                        return <HuddleText key={setting.key} variant="caption">{setting.label}: {label}</HuddleText>;
                      })}
                    </View>
                  </View>
                ) : null}
                {setup.mode === 'custom' ? (
                  <View style={styles.settingsList}>
                    {customControls.map((control) => {
                      const setting = module.settingsSchema.find((candidate) => candidate.key === control.key);
                      if (setting === undefined) return null;
                      return (
                        <View key={control.key} style={styles.settingBlock}>
                          <HuddleText variant="bodyLarge" style={styles.settingLabel}>{control.label}</HuddleText>
                          <View style={styles.optionRow}>
                            {control.options.map((option) => (
                              <Chip
                                key={option.value}
                                label={option.label}
                                selected={option.chosen}
                                disabled={!youAreHost}
                                onPress={() => chooseSetting(setting, option.value)}
                                testID={`setup-option-${setting.key}-${option.value}`}
                              />
                            ))}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
              {youAreHost ? <HuddleButton title="Lock setup" onPress={onFinalize} busy={busy === 'finalize'} accessibilityLabel="Lock game setup" testID="lock-game-setup" style={styles.setupPrimaryAction} /> : null}
              <HuddleText variant="caption" align="center" style={styles.hostOnlyHint}>Host only</HuddleText>
            </>
          ) : (
            <>
              <View style={styles.readySummary} testID="setup-ready-summary">
                <Badge label={setupModeLabel(setup.mode)} tone="ready" />
                <View style={styles.presetLines}>
                  {module.settingsSchema.map((setting) => {
                    const value = settings[setting.key] ?? setting.defaultValue;
                    const label = setting.options.find((option) => option.value === value)?.label ?? value;
                    return <HuddleText key={setting.key} variant="caption">{setting.label}: {label}</HuddleText>;
                  })}
                </View>
              </View>
              <View style={styles.playersHeading}>
                <HuddleText variant="title">Players</HuddleText>
                <HuddleText variant="caption" style={styles.helper}>{readyCount}/{roster.length} ready</HuddleText>
              </View>
              <HuddleText variant="body" align="center" style={styles.helper}>{readyStatus}</HuddleText>
              <View style={styles.setupRoster}>
                {roster.map((seat) => (
                  <PlayerRow key={seat.playerId} displayName={seat.nickname} avatarId={seat.avatar} status={seat.away ? 'away' : setup.readyPlayerIds.includes(seat.playerId) ? 'ready' : 'waiting'} isHost={seat.host} testID={`setup-player-${seat.playerId}`} />
                ))}
              </View>
              <HuddleButton title={currentReady ? 'Ready ✓' : 'I’m ready'} variant="secondary" onPress={onReady} busy={busy === 'ready'} accessibilityLabel={currentReady ? 'Mark not ready' : 'Mark ready'} testID="toggle-game-ready" style={styles.fullWidthAction} />
              {youAreHost ? (
                <>
                  <HuddleButton title={`Start ${module.metadata.title}`} onPress={onStart} busy={busy === 'start'} disabled={!canStart} accessibilityLabel={`Start ${module.metadata.title}`} testID="start-game" style={styles.primaryAction} />
                  <HuddleButton title="Reopen setup" variant="secondary" onPress={onReopen} busy={busy === 'reopen'} accessibilityLabel="Reopen game setup" testID="reopen-game-setup" style={styles.reopenAction} />
                  <HuddleText variant="caption" align="center" style={styles.hostOnlyHint}>Host only</HuddleText>
                </>
              ) : null}
            </>
          )}

          {failure ? <HuddleText variant="caption" align="center" accessibilityRole="alert" testID="setup-error">{failure}</HuddleText> : null}
          {!youAreHost ? (
            <View style={styles.setupBottomActions}>
              <HuddleButton title="Leave" variant="ghost" onPress={onLeave} accessibilityLabel="Leave room" testID="setup-leave" style={styles.fullWidthAction} />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ScreenShell>
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
  const player: GamePlayer = seat === undefined
    ? { playerId: session.playerId, nickname: session.nickname, away: false, avatar: session.avatar }
    : { playerId: seat.playerId, nickname: seat.nickname, away: seat.away, avatar: seat.avatar };
  const module = screen.module as GameModule<unknown, GameEvent>;
  return (
    <View style={styles.runtimeTakeover} testID={`phone-runtime-${module.metadata.id}`}>
      {module.screens.phone({
        state: screen.state,
        player,
        sendEvent: onEvent,
        safeAreaInsets: insets,
        // Keep the platform-owned Host affordance clear of each game module's
        // own header and timer. This remains plain data at the contract seam;
        // the module does not import navigation or platform context.
        hostChromeInsetTop: youAreHost ? spacing['5xl'] : undefined,
        clockRemainingMs: screen.kind === 'game' ? screen.clockRemainingMs : undefined,
      })}
      {youAreHost ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.runtimeTopOverlay,
            {
              top: insets.top + spacing.sm,
              left: insets.left + spacing.lg,
              right: insets.right + spacing.lg,
            },
          ]}
        >
          <HuddleButton
            title="Back to lobby"
            variant="secondary"
            onPress={onBackToLobby}
            accessibilityLabel="Back to lobby"
            testID="runtime-back-to-lobby"
            style={styles.runtimeBackAction}
          />
        </View>
      ) : null}
      {busy === 'event' || failure ? (
        <View
          pointerEvents="none"
          style={[
            styles.runtimeBottomOverlay,
            {
              bottom: insets.bottom + spacing.sm,
              left: insets.left + spacing.lg,
              right: insets.right + spacing.lg,
            },
          ]}
        >
          {busy === 'event' ? <HuddleText variant="caption" align="center">Sending…</HuddleText> : null}
          {failure ? <HuddleText variant="caption" align="center" accessibilityRole="alert" testID="runtime-error">{failure}</HuddleText> : null}
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
}: {
  readonly variant: 'paused' | 'unavailable' | 'finished';
  readonly title: string;
  readonly message: string;
  readonly youAreHost: boolean;
  readonly failure?: string;
  readonly busy: BusyAction;
  readonly primary?: { readonly label: string; readonly onPress: () => void; readonly disabled: boolean; readonly action: Exclude<BusyAction, null> };
  readonly onBackToLobby: () => void;
}) {
  const insets = useSafeAreaInsets();
  const artwork = variant === 'paused'
    ? HEARTBEAT_ARTWORK.phone.gamePaused
    : variant === 'finished'
      ? HEARTBEAT_ARTWORK.phone.gameFinished
      : HEARTBEAT_ARTWORK.phone.seatLost;
  return (
    <ScreenShell tone="background" style={[styles.statusShell, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]} testID={`phone-runtime-${variant}`}>
      <ImageBackground
        source={artwork}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
        accessible={false}
        testID={`phone-runtime-${variant}-artwork`}
      />
      <View pointerEvents="none" style={styles.statusArtworkVeil} />
      <HuddleText
        variant="title"
        align="center"
        accessibilityRole="header"
        style={[styles.statusHeader, { top: insets.top + spacing.lg }]}
      >
        {variant === 'paused' ? 'Game paused' : variant === 'finished' ? 'Great game!' : 'Uh oh!'}
      </HuddleText>
      <View style={styles.statusSheet}>
        <HuddleText variant="title" align="center" accessibilityRole="header">{title}</HuddleText>
        <HuddleText variant="body" align="center">{message}</HuddleText>
        {failure ? <HuddleText variant="caption" align="center" accessibilityRole="alert" testID="runtime-status-error">{failure}</HuddleText> : null}
        {youAreHost && primary ? <HuddleButton title={primary.label} onPress={primary.onPress} busy={busy === primary.action} disabled={primary.disabled} accessibilityLabel={primary.label} testID={`runtime-${primary.action}`} style={styles.fullWidthAction} /> : null}
        {youAreHost ? <HuddleButton title="Back to lobby" variant="secondary" onPress={onBackToLobby} busy={busy === 'end'} accessibilityLabel="Back to lobby" testID="runtime-status-back-to-lobby" style={styles.fullWidthAction} /> : <HuddleText variant="caption" align="center">Waiting for the Host to return to the room.</HuddleText>}
      </View>
    </ScreenShell>
  );
}

/** Branded confirmation sheet for destructive room/lifecycle actions. */
function ConfirmationSheet({
  confirmation,
  busy,
  failure,
  reduceMotion,
  onCancel,
}: {
  readonly confirmation: Confirmation | undefined;
  readonly busy: BusyAction;
  readonly failure?: string;
  readonly reduceMotion: boolean | undefined;
  readonly onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (confirmation === undefined) return null;
  return (
    <Modal
      visible
      transparent
      animationType={reduceMotion === false ? 'fade' : 'none'}
      onRequestClose={onCancel}
      accessibilityViewIsModal
      testID="heartbeat-confirmation-modal"
    >
      <View style={[styles.confirmationScrim, { paddingBottom: insets.bottom }]}>
        <View style={styles.confirmationCard}>
          <View style={styles.sheetHandle} />
          <HuddleText variant="title" align="center" accessibilityRole="header">{confirmation.title}</HuddleText>
          <HuddleText variant="body" align="center" accessibilityRole="text">{confirmation.message}</HuddleText>
          {failure ? (
            <HuddleText
              variant="caption"
              align="center"
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              testID="confirmation-error"
            >
              {failure}
            </HuddleText>
          ) : null}
          <View style={styles.confirmationActions}>
            <HuddleButton title={confirmation.confirmLabel} variant={confirmation.destructive ? 'destructive' : 'primary'} onPress={confirmation.onConfirm} busy={busy === confirmation.action} accessibilityLabel={confirmation.confirmLabel} testID="confirmation-confirm" />
            <HuddleButton title="Cancel" variant="secondary" onPress={onCancel} disabled={busy !== null} accessibilityLabel="Cancel" testID="confirmation-cancel" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: { paddingHorizontal: 0 },
  runtimeTakeover: { flex: 1, backgroundColor: semanticColors.background },
  runtimeTopOverlay: { position: 'absolute', alignItems: 'flex-end', zIndex: 2 },
  runtimeBackAction: { minHeight: 40, paddingHorizontal: spacing.lg, ...shadows.card },
  runtimeBottomOverlay: { position: 'absolute', padding: spacing.sm, borderRadius: radii.lg, backgroundColor: semanticColors.surfaceRaised, gap: spacing.xs, ...shadows.card },
  statusShell: { paddingHorizontal: 0, alignItems: 'center', justifyContent: 'flex-end' },
  statusHeader: { position: 'absolute', right: spacing.lg, left: spacing.lg, zIndex: 1 },
  statusSheet: { width: '100%', paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.lg, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, backgroundColor: semanticColors.surfaceRaised, alignItems: 'center', gap: spacing.md, ...shadows.floating },
  statusArtworkVeil: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(249,241,230,0.08)' },
  scroll: { flexGrow: 1 },
  page: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: spacing.lg, gap: spacing.md },
  eyebrow: { letterSpacing: 1.2, opacity: 0.7 },
  roomNav: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: { width: 64, minHeight: 40, alignItems: 'flex-start', justifyContent: 'center' },
  navTitle: { fontWeight: '800' },
  roomSummary: { alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.sm },
  roomLabel: { letterSpacing: 1.4, opacity: 0.7 },
  successBanner: { width: '100%', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.md, backgroundColor: 'rgba(127,210,182,0.34)', borderWidth: 1, borderColor: 'rgba(49,129,93,0.38)' },
  rosterSection: { gap: spacing.sm },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  rosterList: { gap: spacing.sm },
  lobbyPlayerRow: { minHeight: 64, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderWidth: 1, borderColor: 'rgba(43,31,23,0.14)', backgroundColor: 'rgba(255,255,255,0.2)', ...shadows.none },
  bottomActions: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm, marginTop: 'auto' },
  bottomAction: { flex: 1, paddingHorizontal: spacing.sm },
  hostWaitingPanel: { marginTop: 'auto', padding: spacing.lg, borderRadius: radii.lg, backgroundColor: 'rgba(124,198,255,0.24)', borderWidth: 1, borderColor: 'rgba(124,198,255,0.62)', alignItems: 'center', gap: spacing.xs },
  primaryAction: { minHeight: 54 },
  leaveAction: { alignSelf: 'center', minWidth: 130 },
  pickerNav: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  setupNav: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerPage: { flexGrow: 1 },
  setupPage: { flexGrow: 1 },
  backLink: { minHeight: 36, justifyContent: 'center' },
  viewToggle: { minHeight: 32, minWidth: 54, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(43,31,23,0.2)', borderRadius: radii.pill },
  pickerHeading: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  guestPickerSurface: { alignItems: 'center', gap: spacing.md },
  guestWaitingArt: { width: '100%', height: 218, borderRadius: radii.xl },
  guestWaitingCopy: { gap: spacing.xs },
  passivePickerAnchor: { position: 'absolute', width: 1, height: 1, minHeight: 1, opacity: 0, overflow: 'hidden' },
  carouselStage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minHeight: 330 },
  carouselArrow: { width: 42, minHeight: 42, paddingHorizontal: 0, paddingVertical: 0, borderRadius: radii.round },
  focusedGameCard: { width: 260, minHeight: 346, padding: spacing.lg },
  pickerMetadata: { marginTop: spacing.xs },
  carouselDots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: radii.round, backgroundColor: 'rgba(43,31,23,0.18)' },
  dotSelected: { width: 10, height: 10, backgroundColor: semanticColors.primary },
  comingSoonBadge: { alignSelf: 'center' },
  gameList: { gap: spacing.sm },
  gameListRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: radii.lg, borderWidth: 1, borderColor: 'rgba(43,31,23,0.12)', backgroundColor: 'rgba(255,255,255,0.26)' },
  gameListRowSelected: { borderColor: semanticColors.primary, borderWidth: 2 },
  gameListRowDisabled: { opacity: 0.62 },
  gameListArt: { width: 62, height: 62, borderRadius: radii.md },
  gameListCopy: { flex: 1, gap: spacing['2xs'] },
  listChevron: { fontSize: 28, lineHeight: 30, fontWeight: '400' },
  syncPanel: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: 'rgba(127,210,182,0.72)', backgroundColor: 'rgba(127,210,182,0.2)' },
  syncDots: { flexDirection: 'row', gap: spacing.xs },
  syncDot: { width: 7, height: 7, borderRadius: radii.round, backgroundColor: 'rgba(43,31,23,0.22)' },
  syncDotActive: { backgroundColor: semanticColors.success },
  syncCopy: { flex: 1, gap: spacing['2xs'] },
  pickerPrimaryAction: { minHeight: 54, marginTop: 'auto' },
  fullWidthAction: { width: '100%' },
  setupHeading: { alignItems: 'center', gap: spacing.xs, paddingBottom: spacing.sm },
  setupBrandMark: { width: 48, height: 40 },
  setupPanel: { padding: spacing.md, borderRadius: radii.xl, backgroundColor: 'rgba(255,255,255,0.28)', borderWidth: 1, borderColor: 'rgba(43,31,23,0.12)', gap: spacing.md },
  modeRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  helper: { opacity: 0.68 },
  settingsList: { gap: spacing.md },
  settingBlock: { gap: spacing.sm },
  settingLabel: { fontWeight: '700', fontSize: 16, lineHeight: 22 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  presetSummary: { padding: spacing.md, borderRadius: radii.lg, backgroundColor: 'rgba(255,215,102,0.22)', borderWidth: 1, borderColor: 'rgba(255,215,102,0.58)', gap: spacing.sm },
  presetTitle: { fontSize: 18, lineHeight: 24 },
  presetLines: { gap: spacing['2xs'] },
  readySummary: { width: '100%', padding: spacing.md, borderRadius: radii.xl, backgroundColor: 'rgba(255,255,255,0.34)', borderWidth: 1, borderColor: 'rgba(43,31,23,0.12)', alignItems: 'center', gap: spacing.sm },
  playersHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  setupPrimaryAction: { width: '100%', minHeight: 54, marginTop: 'auto' },
  hostOnlyHint: { opacity: 0.68 },
  reopenAction: { minHeight: 44, paddingHorizontal: spacing.lg },
  setupRoster: { width: '100%', gap: spacing.sm },
  setupBottomActions: { gap: spacing.sm, paddingTop: spacing.xs },
  sheetHandle: { width: 42, height: 5, borderRadius: radii.pill, backgroundColor: 'rgba(43,31,23,0.2)', marginBottom: spacing.xs },
  sheetEyebrow: { letterSpacing: 1.2, opacity: 0.66, alignSelf: 'flex-start' },
  sheetPlayerRow: { width: '100%', minHeight: 68, borderWidth: 1, borderColor: 'rgba(43,31,23,0.12)', backgroundColor: 'rgba(255,255,255,0.3)' },
  sheetActionBlock: { width: '100%', gap: spacing.xs },
  sheetAction: { width: '100%' },
  managementSheet: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, backgroundColor: semanticColors.surfaceRaised, alignItems: 'center', gap: spacing.md, ...shadows.floating },
  confirmationScrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(43,31,23,0.62)' },
  confirmationCard: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, backgroundColor: semanticColors.surfaceRaised, alignItems: 'center', gap: spacing.md, ...shadows.floating },
  confirmationActions: { width: '100%', gap: spacing.sm },
});
