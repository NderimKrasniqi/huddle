import { api } from '@huddle/convex';
import { type Arrivals, isGreeting, JUST_JOINED_MS, noteArrivals } from '@huddle/game-core';
import { type CarouselWindow, carouselWindow, runningGameScreen } from '@huddle/game-registry';
import { colors, elevation } from '@huddle/ui';
import { AnimatedScreen, Avatar, Icon, LoadingIndicator, Surface } from '@huddle/ui/native';
import { useMutation, useQuery } from 'convex/react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { CHOOSE_A_GAME, hostChoosingLine, NOW_VIEWING_CAPTION, nowViewingLine, startControl, type SettingsChoice } from '../game-picker';
import { PickAGameScreen } from '../game-picker/native';
import { BackToLobbyControl, FinishedScreen, GameRuntimeStatusScreen, InGameScreen } from '../game-session/native';
import { useHeartbeat } from '../../platform/presence';
import { phoneSessionTokenStore, type PlayerSession, useSessionToken } from '../../platform/session';
import { OutlinePill, PhoneScreen, PrimaryButton, RoomCodeChip, SeatedHeader, controllerStyles as styles } from '../../ui';
import {
  hostControlFailureMessage,
  hostControlRejectionMessage,
  LEAVE_ROOM,
  leaveConsequence,
  lobbyStanding,
  type LobbyStanding,
  rosterFooterLine,
  rosterRowControls,
  rosterRowIsManageable,
  rosterRowSlot,
  rosterRowSpokenAs,
  seatLossNotice,
  seatedSurface,
  type HostControlAction,
  type RosterRowControl,
  type RosterRowSlot,
  type RosterSeat,
} from './index';

const ROSTER_AVATAR = 36;
const WAITING_AVATAR = 176;
const SHEET_AVATAR = 88;

export function SeatedScreen({
  session,
  onSeatLost,
  onLeft,
}: {
  readonly session: PlayerSession;
  readonly onSeatLost: (reason: string) => void;
  /** This phone gave up its seat on purpose, so it goes back with no notice. */
  readonly onLeft: () => void;
}) {
  const { code } = session;
  useHeartbeat();
  const { roster, answered } = useRoomRoster(session);
  const standing = lobbyStanding(roster, session.playerId);

  // Which of the Host's two states this phone is on: their room, or the picker.
  // One component with a state rather than two routes, as the handoff records —
  // the board draws two screens and they are two *states*, because everything
  // under them (the seat, the roster subscription, the settings the Host has
  // chosen) has to survive moving between them, and a route would remount it.
  //
  // It is also deliberately not derived from `browsingGameIndex`. The room's
  // browsed card is shared — the television and every phone follow it — and
  // which screen *this* Host is looking at is not: a Host who backs out to
  // their room has not un-browsed anything for the room, and the TV should not
  // flick back to the Room behind them.
  const [picking, setPicking] = useState(false);

  // Which seats this phone watched arrive, and which of those greetings it has
  // already spent — the same pair the television keeps, for the same four
  // seconds, now that the Host's roster draws the chip too.
  //
  // Fed the *unanswered* roster on purpose: see `useRoomRoster`. Everything
  // else on this screen takes the flattened one.
  const arrivals = useArrivals(answered);
  const { greeted, noteGreeted } = useGreeted();
  // The Host's settings, held here rather than on the picker below because this
  // screen is the one that survives a game: the picker is unmounted for the
  // whole of a game and remounted on "Back to lobby", and a party playing twice
  // in an evening (the Question Deal) would otherwise find their
  // twenty questions quietly back at ten. It costs nothing on a phone that is
  // not running the room — a choice nothing draws and nothing sends.
  const [settingsChoice, setSettingsChoice] = useState<SettingsChoice>();

  // The room's own word on what it is playing. A separate subscription from the
  // roster because the two change on entirely different beats — this twice a
  // game, the roster on every join, claim and heartbeat.
  //
  // The token rides along so the room knows which player is asking: a running
  // game's state is broadcast redacted, and this phone's own in-flight choices
  // are the part only it may see (`redactStateFor`).
  //
  // Skipped until the keystore has answered, rather than asked once without the
  // token and again with it. The arguments are what a subscription is keyed by,
  // so asking twice means an `undefined` between the two answers — and an
  // `undefined` here reads as the lobby (`runningGameScreen`). A phone that cold
  // starts into a room mid-game would flash that lobby, which is the screen
  // carrying Leave. One subscription, with its final arguments, cannot.
  const sessionToken = useSessionToken();
  const running = useQuery(
    api.games.running,
    sessionToken === undefined ? 'skip' : { roomId: session.roomId, sessionToken },
  );

  // Whether this phone still holds the seat it is drawing. A subscription and
  // not the one-shot that seated it (`resumeSession`): a seat ends for reasons
  // nobody on this phone caused — the Host removes this player, or the TV stays
  // away until the room expires — and until this was watched, neither took the
  // phone off a lobby that no longer existed.
  // `null` is the room's word that the seat is gone; `undefined` is the
  // question still in flight, which is not an answer and moves nobody.
  const seat = useQuery(
    api.players.session,
    sessionToken === undefined ? 'skip' : { sessionToken },
  );

  // Whether this phone is giving up its seat on purpose. The seat subscription
  // reports `null` either way, and this is the only thing that tells the two
  // apart — so `seatLossNotice` is never asked about a departure it cannot
  // explain, which is the case it says outright it must not speak for.
  //
  // A ref rather than state: it is read by an effect that must see the newest
  // value, and it must not schedule a render of its own. `LeaveRoomSheet` sets
  // it before the mutation goes out, so the race with the subscription cannot
  // be lost.
  const leaving = useRef(false);
  const noteLeaving = useCallback(() => {
    leaving.current = true;
  }, []);
  // Scoped to the attempt, not to the mount. A leave that fails leaves this
  // phone seated, and a suppression left standing would eat the *next* seat
  // loss — and with it the `setSession(null)` that `onSeatLost` performs, which
  // would strand the phone on a room it is no longer in, drawing a roster that
  // has stopped updating. That is the exact failure `seat-loss.ts` exists to
  // prevent, arrived at from the other direction.
  const noteStillHere = useCallback(() => {
    leaving.current = false;
  }, []);

  useEffect(() => {
    if (seat === null && !leaving.current) {
      // The roster read in the same render is the room as it was the instant the
      // seat vanished — still peopled if the Host removed this one player, empty
      // if the room itself ended — which is how the notice tells the two apart.
      onSeatLost(seatLossNotice(roster));
    }
  }, [seat, onSeatLost, roster]);
  const screen = runningGameScreen(running);

  // The card the room is browsing. Held here rather than by the picker that
  // draws it, because both host screens read it: the picker draws the card, and
  // the room's count line only offers to start when the room in fact can, which
  // is a question about the card. One subscription answering both is what keeps
  // the two screens from disagreeing about whether the party can begin — and
  // what lets the Host move between them without re-asking.
  const browsingAt = useQuery(api.games.browsing, { roomId: session.roomId });
  const browsing = carouselWindow(browsingAt ?? 0);
  const setupDraft = useQuery(api.games.setup, { roomId: session.roomId });

  // A game ends by returning the Host to their *room*, not to the picker they
  // were on when it started. Phase 2 left "which screen does a room land on
  // after a game" open and sent it here; this is the phone's half of the
  // answer, and it is the same one the television gives — a game ending is the
  // moment a party takes stock of who is still in the room, and people have
  // come and gone during it. Adjusted during render, which is React's own way
  // to reset state when an input changes, and the pattern `JoinScreen` already
  // uses for its notice.
  const inGame = screen.kind === 'game';
  const [wasInGame, setWasInGame] = useState(inGame);

  if (wasInGame !== inGame) {
    setWasInGame(inGame);

    if (inGame) {
      setPicking(false);
    }
  }

  // A host can inherit a room running a game this build cannot decode. That
  // recovery case must remain on the room surface, where Back to lobby exists.
  const stranded = running !== null && running !== undefined && screen.kind === 'lobby';
  const showingPicker =
    picking || (standing.youAreHost && setupDraft !== null && setupDraft !== undefined);
  const surface = seatedSurface({
    runtime: screen.kind,
    youAreHost: standing.youAreHost,
    picking: showingPicker,
    strandedRuntime: stranded,
    hasGameToBrowse: browsing !== undefined,
  });

  if (surface === 'game' && screen.kind === 'game') {
    return (
      <AnimatedScreen key="game">
        <InGameScreen
          code={code}
          module={screen.module}
          state={screen.state}
          roster={roster}
          playerId={session.playerId}
          youAreHost={standing.youAreHost}
        />
      </AnimatedScreen>
    );
  }

  if (screen.kind === 'finished') {
    return (
      <FinishedScreen
        module={screen.module}
        state={screen.state}
        roster={roster}
        playerId={session.playerId}
        youAreHost={standing.youAreHost}
        onChooseAnotherGame={() => setPicking(true)}
        onManagePlayers={() => setPicking(false)}
      />
    );
  }

  if (
    surface === 'runtime-status' &&
    (screen.kind === 'paused' || screen.kind === 'unavailable')
  ) {
    return (
      <AnimatedScreen key="runtime-status">
        <GameRuntimeStatusScreen
          status={screen.kind}
          reason={screen.kind === 'paused' ? screen.reason : undefined}
          disconnectedPlayers={roster
            .filter((player) => player.away)
            .map((player) => player.nickname)}
          youAreHost={standing.youAreHost}
          leaveControl={
            <LeaveControl
              roster={roster}
              youAreHost={standing.youAreHost}
              onLeaving={noteLeaving}
              onLeaveFailed={noteStillHere}
              onLeft={onLeft}
            />
          }
        />
      </AnimatedScreen>
    );
  }

  // Everybody who is not running the room gets one screen and no controls.
  if (surface === 'waiting') {
    return (
      <AnimatedScreen key="waiting">
        <WaitingScreen
          standing={standing}
          browsing={browsing}
          roster={roster}
          onLeaving={noteLeaving}
          onLeaveFailed={noteStillHere}
          onLeft={onLeft}
        />
      </AnimatedScreen>
    );
  }

  // The picker needs a card to draw. `browsing` is `undefined` only in a build
  // with no games at all, which is nothing to pick from — so that Host stays in
  // their room, where the count line and the roster are still true.
  if (surface === 'picker' && browsing !== undefined) {
    return (
      <AnimatedScreen key="picker">
        <PickAGameScreen
          browsing={browsing}
          roster={roster}
          settingsChoice={settingsChoice}
          setupDraft={setupDraft}
          onChooseSetting={setSettingsChoice}
          onBack={() => setPicking(false)}
        />
      </AnimatedScreen>
    );
  }

  return (
    <AnimatedScreen key="room">
      <YourRoomScreen
        code={code}
        roster={roster}
        canStart={browsing !== undefined && startControl(roster, browsing.index).enabled}
        canPick={browsing !== undefined}
        stranded={stranded}
        greeting={(playerId) => isGreeting(arrivals, greeted, playerId)}
        onGreeted={noteGreeted}
        onChooseGame={() => setPicking(true)}
        onLeaving={noteLeaving}
        onLeaveFailed={noteStillHere}
        onLeft={onLeft}
      />
    </AnimatedScreen>
  );
}

/**
 * A fail-closed game boundary. Paused and unavailable responses deliberately
 * carry no state, so this screen never mounts a game control or attempts to
 * guess what the missing state meant.
 */

function YourRoomScreen({
  code,
  roster,
  canStart,
  canPick,
  stranded,
  greeting,
  onGreeted,
  onChooseGame,
  onLeaving,
  onLeaveFailed,
  onLeft,
}: {
  readonly code: string;
  readonly roster: readonly RosterSeat[];
  readonly canStart: boolean;
  /** Whether there is anything to pick — false only in a build with no games. */
  readonly canPick: boolean;
  /**
   * Whether the room is mid-game in something this build does not have.
   *
   * The one case where the Host is on their room while the room is *not* between
   * games. It is reachable: `handOverRoom` can hand a room over mid-game, so an
   * older build can inherit a game it cannot draw. Everybody else on such a
   * phone simply waits, but the Host is the only player who can end a game —
   * `endGame` is Host-only — so without a way back here the room is one nothing
   * in it can move, and End Room, which takes every seat, is the only exit.
   *
   * Phase 3 deleted the screen that used to carry this control and recorded the
   * gap; this is it closed.
   */
  readonly stranded: boolean;
  readonly greeting: (playerId: RosterSeat['playerId']) => boolean;
  readonly onGreeted: (playerId: RosterSeat['playerId']) => void;
  readonly onChooseGame: () => void;
  readonly onLeaving: () => void;
  readonly onLeaveFailed: () => void;
  readonly onLeft: () => void;
}) {
  // Which player's row the Host has opened to manage, if any. Held as the id
  // rather than the seat so the sheet always reads the *current* row off the
  // live roster: a target that goes away between opening the sheet and acting
  // dims transfer without the sheet reopening, and a target that leaves the room
  // (or is removed) drops out of `roster` and closes the sheet on its own.
  const [managing, setManaging] = useState<RosterSeat['playerId']>();
  const managingSeat = roster.find((seat) => seat.playerId === managing);

  return (
    <PhoneScreen>
      <SeatedHeader
        trailing={
          <LeaveControl
            roster={roster}
            youAreHost
            onLeaving={onLeaving}
            onLeaveFailed={onLeaveFailed}
            onLeft={onLeft}
          />
        }
      />

      <View style={styles.roomTitleRow}>
        <Text style={styles.title}>Your room</Text>
        <RoomCodeChip code={code} />
      </View>

      <View style={styles.roster}>
        {roster.map((seat, position) => (
          <RosterRow
            key={seat.playerId}
            seat={seat}
            // The rule belongs between rows, so the first one goes without.
            // Drawn on the row rather than as a view of its own: a separator
            // that is a sibling is a thing that can end up orphaned at the foot
            // of a list when the last row goes.
            first={position === 0}
            greeting={greeting(seat.playerId)}
            onGreeted={onGreeted}
            onManage={setManaging}
          />
        ))}
      </View>

      <View style={styles.countLine}>
        <View style={styles.statusDot} />
        <Text style={styles.aside}>{rosterFooterLine(roster.length, canStart)}</Text>
      </View>

      {stranded ? (
        <>
          <Text style={[styles.waitingFor, styles.asideCentred]}>
            This room is playing a game this phone doesn’t have. Take everyone back
            to the lobby, or update Huddle to play along.
          </Text>
          <BackToLobbyControl />
        </>
      ) : (
        <PrimaryButton
          label={CHOOSE_A_GAME}
          trailingIcon="arrow-right"
          enabled={canPick}
          onPress={onChooseGame}
        />
      )}

      {managingSeat === undefined ? null : (
        <ManagePlayerSheet seat={managingSeat} onDismiss={() => setManaging(undefined)} />
      )}
    </PhoneScreen>
  );
}

/**
 * Phone — the Host's picker (the approved board's "Pick a game").
 *
 * The card the room is browsing, the arrows either side of where it sits in the
 * list, and the button that commits the room to it. The arrows write
 * `browsingGameIndex` and nothing else — the television follows the room, not
 * this phone, so what the Host sees here and what the room sees on the TV
 * cannot come apart.
 *
 * `Your room` at the header's end is this screen's way back, and it is a way
 * back rather than a cancel: browsing is already shared, so there is nothing
 * here to discard.
 */

function WaitingScreen({
  standing,
  browsing,
  roster,
  onLeaving,
  onLeaveFailed,
  onLeft,
}: {
  readonly standing: LobbyStanding;
  /** The card the room is on; `undefined` only in a build with no games. */
  readonly browsing: CarouselWindow | undefined;
  readonly roster: readonly RosterSeat[];
  readonly onLeaving: () => void;
  readonly onLeaveFailed: () => void;
  readonly onLeft: () => void;
}) {
  return (
    <PhoneScreen>
      {/* The board draws a bare wordmark here, and this adds the Leave pill to
          it. The board predates the decision that Leave is everybody's — it was
          drawn while the only way out was the Host's End room — and a player
          with no way to leave the room would make that decision false on the
          one screen most of the party is looking at. */}
      <SeatedHeader
        trailing={
          <LeaveControl
            roster={roster}
            youAreHost={false}
            onLeaving={onLeaving}
            onLeaveFailed={onLeaveFailed}
            onLeft={onLeft}
          />
        }
      />

      {/* No label. The name is in the line directly under it, and an avatar
          that announced itself would make a screen reader say it twice. */}
      {standing.hostAvatar === undefined ? null : (
        <Avatar avatar={standing.hostAvatar} size={WAITING_AVATAR} />
      )}

      <Text style={styles.title}>{hostChoosingLine(standing.hostNickname)}</Text>

      {browsing === undefined ? null : (
        <View style={styles.nowViewing}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{nowViewingLine(browsing.focused.metadata)}</Text>
        </View>
      )}

      <View style={styles.explainer}>
        <Icon name="gamepad" size={32} color={colors.mutedText} />
        <Text style={styles.explainerText}>{NOW_VIEWING_CAPTION}</Text>
      </View>
    </PhoneScreen>
  );
}

/**
 * The header every seated screen wears: the wordmark, and one pill at the far
 * end.
 *
 * The pill is the caller's, because the three screens put different things
 * there — Leave on the room and on the waiting screen, the way back on the
 * picker — and a header that branched on which screen it was drawing would be
 * the screens' business written in the wrong place.
 *
 * `Leave` is finally the word it says. Phase 4 drew this pill and labelled it
 * `End room`, because that is what it still did then and a pill saying Leave
 * that deleted every seat in the room would have cost somebody their party.
 * `players.leaveRoom` is what made the board's own label true.
 */

export function LeaveControl({
  roster,
  youAreHost,
  onLeaving,
  onLeaveFailed,
  onLeft,
}: {
  readonly roster: readonly RosterSeat[];
  readonly youAreHost: boolean;
  /** Called before the mutation — see `leaving` in `YoureInScreen`. */
  readonly onLeaving: () => void;
  /** Called if it fails, so the suppression lasts only as long as the attempt. */
  readonly onLeaveFailed: () => void;
  readonly onLeft: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <OutlinePill label={LEAVE_ROOM.label} onPress={() => setConfirming(true)} />
      {confirming ? (
        <LeaveRoomSheet
          roster={roster}
          youAreHost={youAreHost}
          onLeaving={onLeaving}
          onLeaveFailed={onLeaveFailed}
          onLeft={onLeft}
          onDismiss={() => setConfirming(false)}
        />
      ) : null}
    </>
  );
}

/**
 * The header's pill: an outlined accent control, for the two things at the end
 * of a header bar that are neither the primary action nor a status.
 *
 * Outlined rather than filled because the primary action on every one of these
 * screens is the orange bar at the foot, and two solid oranges on one screen is
 * two primary actions.
 */

function ConfirmSheet({
  onDismiss,
  children,
}: {
  readonly onDismiss: () => void;
  readonly children: ReactNode;
}) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.sheetRoot}>
        {/* The scrim is the backdrop and the way out: a tap anywhere off the
            panel dismisses, the way tapping away from a sheet does everywhere. */}
        <Pressable
          style={[StyleSheet.absoluteFill, styles.sheetScrim]}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />

        <Surface
          elevation={elevation.phoneCard}
          style={[styles.sheetWrapper, styles.sheet]}>
          {children}

          <Pressable
            style={styles.sheetCancel}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.sheetCancelLabel}>Cancel</Text>
          </Pressable>
        </Surface>
      </View>
    </Modal>
  );
}

/**
 * The confirm sheet for leaving: what this phone is giving up, and the two ways
 * out.
 *
 * The Manage Sheet's surface — a centred card over an ink scrim, dismissed by
 * the scrim or by Cancel — because it confirms the same kind of act, pointed the
 * other way: that one takes somebody else's seat, this one takes the reader's.
 *
 * What it says depends on who is leaving (`leaveConsequence`): a Host hands on
 * control when seats remain, while the last seat leaves the TV-owned code open
 * for the next party.
 */

function LeaveRoomSheet({
  roster,
  youAreHost,
  onLeaving,
  onLeaveFailed,
  onLeft,
  onDismiss,
}: {
  readonly roster: readonly RosterSeat[];
  readonly youAreHost: boolean;
  readonly onLeaving: () => void;
  readonly onLeaveFailed: () => void;
  readonly onLeft: () => void;
  readonly onDismiss: () => void;
}) {
  const leaveRoom = useMutation(api.players.leaveRoom);
  const [leaving, setLeaving] = useState(false);
  const [failure, setFailure] = useState<string>();

  async function confirm() {
    setLeaving(true);
    setFailure(undefined);

    try {
      const sessionToken = await phoneSessionTokenStore.read();

      if (sessionToken === null) {
        setFailure(hostControlRejectionMessage({ kind: 'notInRoom' }));
        return;
      }

      // Marked *before* the mutation, not after it. The seat subscription is
      // about to report `null` and there is no ordering guarantee that this
      // sheet's `onLeft` runs first — see `leaving` in `YoureInScreen`. Setting
      // it here means the race cannot be lost; `onLeaveFailed` in the catch is
      // what keeps the suppression scoped to this attempt rather than to the
      // life of the screen.
      onLeaving();
      await leaveRoom({ sessionToken });
      // The phone takes itself back to the form. It knows why it is going, so
      // it goes with no notice — the one thing `seatLossNotice` must never be
      // asked to speak for.
      onLeft();
    } catch (error) {
      // In the catch and not in `finally`: `finally` runs on the way out of a
      // *successful* leave too, and clearing the flag there would re-open the
      // race it exists to close — the parent has not unmounted yet, and the
      // subscription's `null` is still on its way.
      onLeaveFailed();
      setFailure(hostControlFailureMessage(error));
    } finally {
      setLeaving(false);
    }
  }

  return (
    <ConfirmSheet onDismiss={onDismiss}>
      <Text style={styles.sheetTitle}>{LEAVE_ROOM.title}</Text>
      <Text style={styles.sheetBody}>{leaveConsequence(roster.length, youAreHost)}</Text>

      <Pressable
        style={styles.stretch}
        disabled={leaving}
        onPress={() => void confirm()}
        accessibilityRole="button"
        accessibilityState={{ disabled: leaving, busy: leaving }}
      >
        {({ pressed }) => (
          <Surface
            elevation={elevation.phoneSmall}
            style={[styles.stretch, [styles.button, pressed && styles.buttonPressed]]}>
            {leaving ? (
              <LoadingIndicator size="small" color={colors.inverse} label="Leaving room" />
            ) : null}
            <Text style={styles.buttonLabel}>
              {leaving ? LEAVE_ROOM.busyLabel : LEAVE_ROOM.confirmLabel}
            </Text>
          </Surface>
        )}
      </Pressable>

      {failure === undefined ? null : (
        <Text style={styles.failure} accessibilityLiveRegion="polite">
          {failure}
        </Text>
      )}
    </ConfirmSheet>
  );
}

/**
 * One player, as the approved board draws a roster row: a circular avatar, the
 * nickname, and the right-hand slot, on no surface of its own and separated
 * from the row above by a hairline.
 *
 * The away treatment is the one the away-badge task settled on and the TV seats
 * wear: the face dims to the system's "present but unavailable" opacity and the
 * nickname goes to muted text rather than dimming with the circle — 30% ink is
 * not text any more. What a slot says in colour alone is what
 * `rosterRowSpokenAs` exists to say in words.
 *
 * Every row but the Host's own opens the manage sheet: the room is the Host's
 * to hand over or clear a seat from, and `rosterRowIsManageable` is where
 * "every row but the Host's own" is decided, so the row becomes a button
 * exactly where a control is on offer. The Host's own row stays a plain label —
 * there is nothing to do to oneself (`targetIsSelf`) — and is the one that
 * carries "(You)", since it is the only row a reader could mistake for
 * somebody else's.
 */

function RosterRow({
  seat,
  first,
  greeting,
  onGreeted,
  onManage,
}: {
  readonly seat: RosterSeat;
  /** The first row of the list, which draws no rule above it. */
  readonly first: boolean;
  readonly greeting: boolean;
  readonly onGreeted: (playerId: RosterSeat['playerId']) => void;
  readonly onManage: (playerId: RosterSeat['playerId']) => void;
}) {
  const slot = rosterRowSlot(seat, greeting);
  const away = slot === 'away';
  const manageable = rosterRowIsManageable(seat);
  const { playerId } = seat;

  // Four seconds, then the row settles into whatever it steadily is. Counted
  // here because the row is what is drawing the chip, and spent upwards so the
  // screen above remembers — a greeting this phone has already given must not
  // come back when the roster next changes. `onGreeted` is idempotent.
  //
  // **The cleanup spends it too, and that is the important half.** Being an
  // arrival is permanent for as long as the seat is; only `greeted` ends a
  // greeting. So an unmount inside the four seconds that merely cancelled the
  // timer would leave the greeting unspent and run it again on the next mount —
  // and this row is unmounted by the most travelled move on the screen, the
  // Host stepping to the picker and back, as well as by a game starting. A chip
  // that reappeared every round trip, or greeted somebody again after ten
  // minutes of trivia, is worse than one cut short. The television's seat makes
  // the same trade in the same words.
  useEffect(() => {
    if (!greeting) {
      return;
    }

    const settling = setTimeout(() => onGreeted(playerId), JUST_JOINED_MS);

    return () => {
      clearTimeout(settling);
      onGreeted(playerId);
    };
  }, [greeting, onGreeted, playerId]);

  const row = (
    <View style={[styles.rosterRow, !first && styles.rosterRowRuled]}>
      <Avatar
        avatar={seat.avatar}
        size={ROSTER_AVATAR}
        label={seat.nickname}
        style={away ? styles.rosterAway : undefined}
      />

      <Text style={[styles.rosterName, away && styles.rosterNameAway]} numberOfLines={1}>
        {seat.nickname}
        {seat.host ? <Text style={styles.rosterYou}> (You)</Text> : null}
      </Text>

      <RosterSlot slot={slot} />
    </View>
  );

  // A manageable row is a button that opens the sheet; the Host's own row is a
  // plain label with nothing to press.
  return manageable ? (
    <Pressable
      style={styles.stretch}
      onPress={() => onManage(playerId)}
      accessibilityRole="button"
      accessibilityLabel={rosterRowSpokenAs(seat, greeting)}
      accessibilityHint="Opens options to make host or remove"
    >
      {row}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={rosterRowSpokenAs(seat, greeting)} style={styles.stretch}>
      {row}
    </View>
  );
}

/**
 * The right-hand end of a roster row: what this player is, in the fewest marks
 * that say it.
 *
 * Four states and three shapes — the Host gets a word and the crown, an arrival
 * gets a word in a chip, and the two steady presences get a dot, because
 * "online" and "away" are the ones a room reads at a glance down the column
 * rather than one at a time. All four are drawn here rather than shipped as the
 * badge artwork the package delivered: a chip is a border, a radius and a word,
 * and those three scale with the type around them where a bitmap does not.
 *
 * Nothing here is spoken. The row above owns one accessibility label for the
 * whole of itself (`rosterRowSpokenAs`), which is what keeps a reader hearing
 * one sentence per player instead of a name and then a badge.
 */

function RosterSlot({ slot }: { readonly slot: RosterRowSlot }) {
  switch (slot) {
    case 'host':
      return (
        <View style={styles.hostSlot}>
          <Text style={styles.hostSlotText}>HOST</Text>
          <Icon name="crown" size={16} color={colors.accent} />
        </View>
      );
    case 'just-joined':
      return (
        <View style={styles.justJoinedChip}>
          <Text style={styles.justJoinedText}>JUST JOINED</Text>
        </View>
      );
    case 'away':
      return (
        <View style={styles.awaySlot}>
          <Text style={styles.awayText}>Away</Text>
          <Icon name="clock" size={14} color={colors.away} />
        </View>
      );
    default:
      return <View style={styles.statusDot} />;
  }
}

/**
 * The Host's controls for one player, over the lobby (task 3.7): make them host,
 * or remove them from the room.
 *
 * It is a sheet — a confirm surface summoned over the roster — rather than
 * buttons on every row, for two reasons the roster's own notes give: the rows
 * already run below the fold from about the sixth player (the Host Roster), so
 * per-row controls would push the count line further off-screen, and
 * removal deletes a seat, which is worth the deliberate second surface a stray
 * thumb does not land on. Opening the row *is* naming the target; the sheet is
 * where the act is chosen and confirmed.
 *
 * Which controls it draws and whether each is live comes from `rosterRowControls`
 * — the same pure answer the row's chevron is gated on — so the sheet and the
 * server agree on what is offered. Every refusal the mutations can still throw
 * (the roster is a live subscription and can be a beat stale) is read for its
 * kind and shown by `hostControlFailureMessage`, never swallowed: a host who
 * taps and sees nothing happen has no way to make sense of it.
 */

function ManagePlayerSheet({
  seat,
  onDismiss,
}: {
  readonly seat: RosterSeat;
  readonly onDismiss: () => void;
}) {
  const transferHost = useMutation(api.players.transferHost);
  const removePlayer = useMutation(api.players.removePlayer);
  // Which action is in flight, so the pressed control alone reads as busy and
  // both are locked while either runs.
  const [busy, setBusy] = useState<HostControlAction>();
  const [failure, setFailure] = useState<string>();
  const controls = rosterRowControls(seat);
  const away = rosterRowSlot(seat) === 'away';

  async function run(action: HostControlAction) {
    setBusy(action);
    setFailure(undefined);

    try {
      const sessionToken = await phoneSessionTokenStore.read();

      if (sessionToken === null) {
        // A phone that cannot say who it is is in no room to run — the server's
        // own word for that is the one to show.
        setFailure(hostControlRejectionMessage({ kind: 'notInRoom' }));
        return;
      }

      const mutate = action === 'transfer' ? transferHost : removePlayer;
      await mutate({ sessionToken, playerId: seat.playerId });
      // The room's own subscription now carries the result — a transfer unseats
      // this phone as Host and takes the whole roster section with it, a removal
      // drops the row — so there is nothing left to manage and the sheet closes.
      onDismiss();
    } catch (error) {
      setFailure(hostControlFailureMessage(error));
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <ConfirmSheet onDismiss={onDismiss}>
      {/* The board stacks the target: face, name, state. Centred and vertical
          rather than the row this used to be, because the sheet is about one
          person and a row reads as one of a list. */}
      <View style={styles.sheetHeader}>
        <View>
          <Avatar
            avatar={seat.avatar}
            size={SHEET_AVATAR}
            label={seat.nickname}
            style={away ? styles.rosterAway : undefined}
          />

          {/* The clock on the avatar's shoulder, as the board draws an away
              target. It repeats the word below it on purpose: the face is
              dimmed, and a dimmed face with no mark on it reads as a rendering
              fault rather than as a state. Unspoken — the line under it is the
              same news in words. */}
          {away ? (
            <View style={styles.sheetAwayBadge}>
              <Icon name="clock" size={14} color={colors.away} />
            </View>
          ) : null}
        </View>

        <Text style={styles.sheetName} numberOfLines={1}>
          {seat.nickname}
        </Text>

        <Text style={styles.sheetState}>{away ? 'Away' : 'Online'}</Text>
      </View>

      {controls.map((control) => (
        <ManageAction
          key={control.action}
          control={control}
          nickname={seat.nickname}
          busy={busy === control.action}
          // One action at a time: while either is in flight, neither is pressable.
          locked={busy !== undefined}
          onPress={() => void run(control.action)}
        />
      ))}

      {failure === undefined ? null : (
        <Text style={styles.failure} accessibilityLiveRegion="polite">
          {failure}
        </Text>
      )}
    </ConfirmSheet>
  );
}

/**
 * One control in the manage sheet: a full-width Soft Minimal button that runs a
 * host power, or sits dimmed with the line saying why it cannot.
 *
 * Remove wears the same accent "this ends something" face as Back to lobby,
 * because deleting a seat is not undone. Transfer uses the standard primary
 * treatment. A disabled transfer (an away target) keeps its place and
 * says what to do instead rather than vanishing, the way the start control does
 * for a room it cannot start.
 */

function ManageAction({
  control,
  nickname,
  busy,
  locked,
  onPress,
}: {
  readonly control: RosterRowControl;
  readonly nickname: string;
  readonly busy: boolean;
  readonly locked: boolean;
  readonly onPress: () => void;
}) {
  const remove = control.action === 'remove';
  const pressable = control.enabled && !locked;
  // Naming the target on the button, not just in the header above, is the
  // courtesy a destructive tap earns: the reader confirms who as they confirm
  // what.
  const spokenAs =
    control.action === 'transfer'
      ? `Make ${nickname} host`
      : `Remove ${nickname} from the room`;

  // Remove is the sheet's one orange bar; transfer is quieter, which is the
  // board's own reading and the system's — one primary per surface, and the
  // primary here is the act the Host opened this sheet to be sure about.
  //
  // A control that cannot be pressed goes inert rather than merely faded: the
  // soft fill and muted ink the board draws on the disabled `Make host`. The
  // 30% dim this used to wear is the treatment for something *present but
  // unavailable*, which is right for an away face and wrong for a button — a
  // ghosted orange bar still reads as the thing to press.
  const face = !pressable ? styles.buttonInert : remove ? undefined : styles.buttonSecondary;
  const labelFace = !pressable
    ? styles.buttonLabelInert
    : remove
      ? undefined
      : styles.buttonLabelSecondary;
  const glyph = !pressable ? colors.mutedText : remove ? colors.inverse : colors.ink;

  return (
    <View style={styles.stretch}>
      <Pressable
        style={styles.stretch}
        disabled={!pressable}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={spokenAs}
        accessibilityState={{ disabled: !pressable, busy }}
      >
        {({ pressed }) => (
          <Surface
            elevation={elevation.phoneCard}
            style={[styles.stretch, [styles.button, face, pressed && styles.buttonPressed]]}>
            {busy ? (
              <LoadingIndicator size="small" color={glyph} label={spokenAs} />
            ) : (
              <Icon name={remove ? 'trash' : 'crown'} size={18} color={glyph} />
            )}
            <Text style={[styles.buttonLabel, labelFace]}>
              {busy ? 'Working…' : control.label}
            </Text>
          </Surface>
        )}
      </Pressable>

      {control.disabledBecause === undefined ? null : (
        <Text style={[styles.waitingFor, styles.asideCentred]}>{control.disabledBecause}</Text>
      )}
    </View>
  );
}

/**
 * The Host's settings for the card they are on, drawn from whatever the game
 * declares (the Settings Schema).
 *
 * It reads its schema off the module the carousel is focused on and its labels
 * off that schema, so it names no game and no setting: a game that declares
 * three chips gets three, a game that declares none draws nothing here, and
 * neither is a change to this component. Only the Host's phone mounts it, and
 * the settings it produces only ever leave as an argument of `startGame`, which
 * refuses a phone that is not running the room.
 */

function useArrivals(
  roster: readonly RosterSeat[] | undefined,
): Arrivals<RosterSeat['playerId']> | undefined {
  const [arrivals, setArrivals] = useState<Arrivals<RosterSeat['playerId']>>();
  const noted = roster === undefined ? arrivals : noteArrivals(arrivals, roster);

  if (noted !== arrivals) {
    setArrivals(noted);
  }

  return noted;
}

/**
 * Which greetings this phone has already spent.
 *
 * Held above the switch between the Host's two screens and a running game, for
 * the reason the television holds its own copy above the same switch: a
 * greeting is four seconds of this screen's life, and remounting the roster —
 * which moving to the picker and back does, and a game ending does — must not
 * announce everybody who joined before it all over again.
 */

function useGreeted(): {
  readonly greeted: ReadonlySet<RosterSeat['playerId']>;
  readonly noteGreeted: (playerId: RosterSeat['playerId']) => void;
} {
  const [greeted, setGreeted] = useState<ReadonlySet<RosterSeat['playerId']>>(() => new Set());

  const noteGreeted = useCallback((playerId: RosterSeat['playerId']) => {
    setGreeted((already) => (already.has(playerId) ? already : new Set(already).add(playerId)));
  }, []);

  return { greeted, noteGreeted };
}

/**
 * The Host's tap that starts the game (handoff §5's "Choose a game", with only
 * one to choose).
 *
 * It offers the Registry's entry rather than a game it names, so the carousel
 * task replaces what is browsed and not this control. The disabled state says
 * what the room is waiting for — the server refuses a short party too, and that
 * refusal is the rule; this is the courtesy of not making the Host find out by
 * pressing.
 */

function useRoomRoster(session: PlayerSession): {
  /** The room as it stands, or `[]` while the answer is in flight. */
  readonly roster: readonly RosterSeat[];
  /** The same answer with the in-flight moment intact — for `useArrivals` alone. */
  readonly answered: readonly RosterSeat[] | undefined;
} {
  const answered = useQuery(api.players.roster, { roomId: session.roomId });

  return { roster: answered ?? [], answered };
}
