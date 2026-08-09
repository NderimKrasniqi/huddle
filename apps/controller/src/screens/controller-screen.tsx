import { api } from '@huddle/convex';
import {
  type Arrivals,
  AVATAR_IDS,
  type AvatarId,
  gamePlayersFrom,
  type GameEvent,
  type GameMetadata,
  type GameModule,
  type GamePlayer,
  type GameSettings,
  type GameSettingsSchema,
  isGreeting,
  JUST_JOINED_MS,
  noteArrivals,
  ROOM_CODE_LENGTH,
} from '@huddle/game-core';
import {
  carouselWindow,
  type CarouselWindow,
  nextIndex,
  previousIndex,
  runningGameScreen,
} from '@huddle/game-registry';
import {
  borderWidth,
  codeLetterBox,
  colors,
  fontFamily,
  type IconName,
  letterSpacing,
  minBodyFontSize,
  opacity,
  radius,
  elevation,
} from '@huddle/ui';
import { Avatar, Icon, Surface, Wordmark } from '@huddle/ui/native';
import { useConvex, useMutation, useQuery } from 'convex/react';
import { useLocalSearchParams } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  activeCodeCell,
  canJoin,
  codeEntry,
  isCodeComplete,
  joinFailureMessage,
  nicknameEntry,
  recallIdentity,
  rememberAvatar,
  rememberName,
  shouldMoveToNickname,
} from '../features/join';
import {
  BACK_TO_ROOM,
  backToLobbyLabel,
  CHOOSE_A_GAME,
  gameToStart,
  hostChoosingLine,
  hostControlFailureMessage,
  hostControlRejectionMessage,
  leaveConsequence,
  LEAVE_ROOM,
  lifecycleFailureMessage,
  NOW_VIEWING_CAPTION,
  nowViewingLine,
  seatLossNotice,
  startControl,
} from '../features/game-session';
import {
  lobbyStanding,
  rosterFooterLine,
  rosterRowSlot,
  rosterRowSpokenAs,
  type HostControlAction,
  type LobbyStanding,
  type RosterRowControl,
  type RosterRowSlot,
  type RosterSeat,
  rosterRowControls,
  rosterRowIsManageable,
} from '../features/room';
import {
  type SettingsChoice,
  settingChosen,
  settingsControls,
  settingsToStart,
} from '../features/game-picker';
import { PhoneScreen } from '../ui/phone-screen';
import { phoneIdentityStore } from '../platform/storage';
import { type ForegroundWatch, keepPresent } from '../platform/presence';
import {
  joinScreenState,
  type PlayerSession,
  rememberSession,
  resumeSession,
} from '../platform/session';
import { phoneSessionTokenStore } from '../platform/session';

/** How long the caret in the active cell rests between showing and hiding. */
const CARET_BLINK_MS = 530;

/** How far a pressed button travels into its own shadow. */
const PRESS_TRAVEL = 2;

/**
 * The join form's avatar tile, and the gap between two of them.
 *
 * Four across is the board's grid and it is held to that by arithmetic rather
 * than by luck: `avatarGrid` caps its width at four tiles and three gaps, so ten
 * avatars are two full rows and a pair on every phone wide enough for the row at
 * all (292pt of content, which the narrowest phone Huddle draws on clears by
 * 50). Wrapping alone would have given a wider phone five and a narrower one
 * three, and the last row's ragged pair is the shape a player reads the grid by.
 */
const AVATAR_TILE = 64;
const AVATAR_GAP = 12;
const AVATAR_COLUMNS = 4;

/** The roster row's circular avatar. */
const ROSTER_AVATAR = 36;

/**
 * The waiting screen's hero — the Host's face, at the size the board draws it.
 * It is the only thing on that screen with anything to look at, which is what
 * earns it more than twice the manage sheet's.
 */
const WAITING_AVATAR = 176;

/** The manage sheet's hero: one player, named and about to be acted on. */
const SHEET_AVATAR = 88;

/**
 * React Native's `AppState`, in the shape `keepPresent` watches: whether the app
 * is in front of its owner right now, and word of it whenever that changes.
 *
 * Only `active` counts as the foreground. iOS reports `inactive` while the app
 * switcher or a call banner sits over the app — nobody is playing then either,
 * and a glance away that brief is absorbed by the ten seconds the room waits
 * before it says anything about anybody.
 */
const watchAppForeground: ForegroundWatch = (onChange) => {
  onChange(AppState.currentState === 'active');
  const watching = AppState.addEventListener('change', (state) => onChange(state === 'active'));
  return () => watching.remove();
};

/**
 * The Controller's first screen (docs/design/soft-minimal-handoff.md §2 and §4): the
 * Room Code off the television and a nickname, then the room's answer.
 *
 * The two are one screen rather than two routes: joining is not somewhere a
 * player navigates to, it is the same screen learning who they are. It also
 * means a rejection lands back on a form that still holds what they typed.
 */
export default function JoinScreen() {
  // The code a scanned Join Link brought with it, if the phone arrived that way
  // (`app/join/[code].tsx`). It is the only difference a scanned join makes —
  // the nickname is still typed.
  const { code: linkedCode } = useLocalSearchParams<{ code?: string }>();
  const convex = useConvex();

  // The seat this phone already holds: `undefined` while its Session Token and
  // the room are still being asked, `null` once the answer is that it holds
  // none. A player who force-quit mid-party is nobody's new arrival, so the
  // join form is what this screen falls back to rather than what it opens with.
  const [session, setSession] = useState<PlayerSession | null>();

  // Why the phone is on the join form, when it landed there by losing a seat
  // rather than by never having one. Carried from the seated screen to the form
  // so a removed player is told they were removed instead of finding themselves
  // inexplicably back at the start. `undefined` on an ordinary launch.
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    // Safe on every mount, unlike the TV's `openRoom`: rejoining reads, so a
    // remount asks the same question again instead of taking a second seat.
    // It may answer twice — a bounded blank screen first, the room's real word
    // whenever it lands (see `resumeSession`) — and this state takes both.
    return resumeSession(
      phoneSessionTokenStore,
      (sessionToken) => convex.query(api.players.session, { sessionToken }),
      // A late answer fills a blank, and never overwrites a seat. Between the
      // deadline and the room finally answering, the player may have joined
      // somewhere else — and the room they are in now beats the one they were
      // in then, whichever order the two arrive in.
      (late) => setSession((current) => current ?? late),
    );
  }, [convex]);

  // A scanned Join Link starting a fresh form is a fresh context: a seat-loss
  // notice about the room this phone just left has nothing to say about the room
  // a new link names, so it is dropped the moment the link changes rather than
  // riding along to it. Adjusted during render — React's own way to reset state
  // when an input changes — since the notice belongs to the code it arrived on.
  const [noticeLink, setNoticeLink] = useState(linkedCode);
  if (noticeLink !== linkedCode) {
    setNoticeLink(linkedCode);
    setNotice(undefined);
  }

  const state = joinScreenState(session, linkedCode ?? '');

  if (state.kind === 'restoring') {
    // Nothing yet — the launch is already blank behind the root layout's font
    // gate, on a window painted the Soft Minimal canvas. Drawing the join form
    // here instead would flash the wrong screen at every player who is in fact
    // already in the room. It is bounded: `resumeSession` will say "no seat"
    // rather than let a phone that cannot reach the backend wait for ever.
    return null;
  }

  if (state.kind === 'seated') {
    // A seat can end without this phone doing anything: the Host ends the room
    // or removes this player, or the room expires under a party that went quiet.
    // Forgetting the seat here is what sends the phone back to the form — the
    // screen below watches the room for it.
    return (
      <YoureInScreen
        session={state.session}
        onSeatLost={(reason) => {
          setNotice(reason);
          setSession(null);
        }}
        // No notice. A phone that tapped Leave knows why it is here, and
        // `seatLossNotice` has no true sentence for a departure nobody imposed.
        onLeft={() => setSession(null)}
      />
    );
  }

  // Keyed by the link so a second Join Link scanned while this screen is
  // already open starts the form over on the room it names, rather than leaving
  // the first room's code in tiles the player thinks they just replaced — which
  // covers the phone that already holds a seat and has just scanned another
  // room's TV, since `joinScreenState` sends that scan here. A typed join has
  // no link and so a constant key: nothing remounts under somebody's thumbs.
  return (
    <JoinForm
      key={linkedCode ?? ''}
      linkedCode={linkedCode ?? ''}
      onSeated={setSession}
      notice={notice}
    />
  );
}

function JoinForm({
  linkedCode,
  onSeated,
  notice,
}: {
  readonly linkedCode: string;
  readonly onSeated: (session: PlayerSession) => void;
  /** Why the phone is back here, if it landed by losing a seat rather than fresh. */
  readonly notice?: string;
}) {
  const prefilledCode = codeEntry(linkedCode);

  const [code, setCode] = useState(prefilledCode);
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<AvatarId>(AVATAR_IDS[0]);
  const [joining, setJoining] = useState(false);
  const [failure, setFailure] = useState<string>();

  // The seat-loss notice stops being the news the moment the player does
  // anything about it — touches a field, or taps Join — so it is dismissed on
  // the first of those rather than lingering over a form they have moved on to.
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const showNotice = notice !== undefined && !noticeDismissed;

  const nameField = useRef<TextInput>(null);
  const joinRoom = useMutation(api.players.joinRoom);

  // The name this phone last joined under, dropped into the field the way a
  // browser fills a login it has seen before. It only ever *seeds* an empty
  // field: `touched` latches the first keystroke, so a slow read that lands
  // after the player has started typing their own name is ignored rather than
  // allowed to overwrite it. Read once per mount — the form remounts on a new
  // Join Link (see `JoinScreen`), which re-asks on its own.
  const touched = useRef(false);
  useEffect(() => {
    let active = true;
    void recallIdentity(phoneIdentityStore).then((remembered) => {
      if (active && !touched.current && remembered.avatar !== null) {
        setAvatar(remembered.avatar);
      }
      if (active && !touched.current && remembered.nickname !== null) {
        setNickname(remembered.nickname);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // A rejection is about what the fields held when Join was tapped, so it stops
  // being true the moment either field changes: "Ada is already in that room"
  // must not still be on screen while its owner types a different name.
  function enterCode(typed: string) {
    const entered = codeEntry(typed);
    setCode(entered);
    setFailure(undefined);
    setNoticeDismissed(true);
    // The last letter advances the way every letter before it did — off the
    // tiles and into the only field left to fill.
    if (shouldMoveToNickname(code, entered)) {
      nameField.current?.focus();
    }
  }

  function enterNickname(typed: string) {
    // The player is typing their own name now, so a prefill that has not landed
    // yet must not land on top of it.
    touched.current = true;
    setNickname(nicknameEntry(typed));
    setFailure(undefined);
    setNoticeDismissed(true);
  }

  async function join() {
    const claimed = nickname.trim();
    setJoining(true);
    setFailure(undefined);
    setNoticeDismissed(true);

    try {
      // The token goes to the phone's storage and the seat goes to the screen:
      // it is what this player is identified by from now on, and nothing that
      // renders needs to hold it. The nickname shown is the room's, not the one
      // typed — the same value a rejoin would come back with.
      const { sessionToken, ...seat } = await joinRoom({ code, nickname: claimed, avatar });
      await rememberSession(phoneSessionTokenStore, sessionToken);
      // The name that just worked, so the next visit opens with it. A courtesy,
      // not a credential — it never blocks the seat this join already won.
      void rememberName(phoneIdentityStore, claimed);
      void rememberAvatar(phoneIdentityStore, avatar);
      onSeated(seat);
    } catch (error) {
      // Every reason the room can refuse is one the player can act on, so the
      // rejection is read for its kind and shown, not logged and swallowed.
      setFailure(joinFailureMessage(error));
    } finally {
      setJoining(false);
    }
  }

  const ready = canJoin(code, nickname);

  return (
    <PhoneScreen>
      <View style={styles.heading}>
        <Wordmark height={20} />
        <Text style={styles.title}>Join the room</Text>
      </View>

      {showNotice ? (
        <Text style={styles.notice} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.label}>ROOM CODE</Text>
        <CodeTiles code={code} onChange={enterCode} autoFocus={!isCodeComplete(prefilledCode)} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>YOUR NAME</Text>
        {/* The Soft Minimal surface is the wrapper's, not the field's: the shadow
            is cast by a view, and a TextInput owns its own text box. */}
        <Surface
          elevation={elevation.phoneSmall}
          style={[styles.stretch, styles.nameField]}>
          <TextInput
            ref={nameField}
            style={styles.nameInput}
            value={nickname}
            onChangeText={enterNickname}
            placeholder="Ada"
            placeholderTextColor={colors.mutedText}
            autoCapitalize="words"
            autoCorrect={false}
            autoFocus={isCodeComplete(prefilledCode)}
            returnKeyType="go"
            onSubmitEditing={() => {
              if (ready && !joining) {
                void join();
              }
            }}
            accessibilityLabel="Your name"
          />
        </Surface>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>PICK YOUR AVATAR</Text>
        <View style={styles.avatarGrid}>
          {AVATAR_IDS.map((id) => {
            const chosen = id === avatar;

            return (
              <Pressable
                key={id}
                onPress={() => setAvatar(id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: chosen }}
                accessibilityLabel={id.replace(/-/gu, ' ')}
              >
                <Avatar
                  avatar={id}
                  size={AVATAR_TILE}
                  shape="tile"
                  style={chosen ? styles.avatarChosen : undefined}
                />

                {/* The board's tick, on the chosen tile's shoulder. The accent
                    ring alone is the selection; this is what makes it legible
                    to somebody who cannot tell the ring from the artwork's own
                    warm edge. Unlabelled — the tile it sits on is already a
                    radio that reports `selected`, and a screen reader saying
                    "check" after "selected" would be the same news twice. */}
                {chosen ? (
                  <View style={styles.avatarTick}>
                    <Icon name="check" size={14} color={colors.inverse} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.field}>
        <Pressable
          style={styles.stretch}
          disabled={!ready || joining}
          onPress={() => void join()}
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready || joining }}
        >
          {({ pressed }) => (
            <Surface
              elevation={elevation.phoneCard}
              // Dimming belongs to the whole sticker: fading the face alone
              // would leave a solid shadow under a ghosted button.
              style={[[styles.stretch, !ready && styles.buttonUnavailable], [styles.button, pressed && styles.buttonPressed]]}>
              <Text style={styles.buttonLabel}>{joining ? 'Joining…' : 'Join'}</Text>
            </Surface>
          )}
        </Pressable>

        {failure === undefined ? null : (
          <Text style={styles.failure} accessibilityLiveRegion="polite">
            {failure}
          </Text>
        )}
      </View>
    </PhoneScreen>
  );
}

/**
 * The Room Code, one tile per letter, per the handoff: the typed letters in
 * their Soft Minimal colors, a cobalt cell with a blinking caret where the next
 * letter goes, and dashed cells for the rest.
 *
 * One invisible field sits over the whole row rather than one per tile. The row
 * then holds a single Room Code — which is what a Room Code is — so advancing a
 * cell, backspacing into the previous one, and a code arriving whole from a
 * scanned Join Link are all the same edit, and none of them is a hop between
 * four widgets that each own a letter.
 */
function CodeTiles({
  code,
  onChange,
  autoFocus,
}: {
  readonly code: string;
  readonly onChange: (typed: string) => void;
  readonly autoFocus: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const activeCell = activeCodeCell(code);
  const codeField = useRef<TextInput>(null);

  // The visible tiles are deliberately not TextInputs. On iOS, moving from
  // the nickname field back to an invisible TextInput is not reliable if the
  // keyboard is already changing owners, so give the whole row an explicit
  // focus target and ask for focus again after the tap has settled.
  function focusCodeField() {
    requestAnimationFrame(() => codeField.current?.focus());
  }

  return (
    <View>
      <View style={styles.tiles}>
        {Array.from({ length: ROOM_CODE_LENGTH }, (_unused, position) => {
          const letter = code.charAt(position);
          const active = position === activeCell;

          return (
            <View
              key={position}
              style={[
                styles.tile,
                active && styles.tileActive,
                letter === '' && !active && styles.tileEmpty,
              ]}
            >
              {letter === '' ? (
                active && focused ? <BlinkingCaret /> : null
              ) : (
                <Text style={styles.tileLetter}>
                  {letter}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={focusCodeField}
        accessible={false}
      />

      <TextInput
        ref={codeField}
        style={styles.codeInput}
        value={code}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPressIn={focusCodeField}
        autoFocus={autoFocus}
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect={false}
        spellCheck={false}
        showSoftInputOnFocus
        // No `maxLength`: the entry is what caps the code at four letters, and
        // it does it after discarding whatever is not a letter — so a pasted
        // " kwrd " still lands as KWRD instead of stopping at a space.
        caretHidden
        accessibilityLabel="Room code"
      />
    </View>
  );
}

/** The caret in the active cell — cobalt, and blinking, as the handoff draws it. */
function BlinkingCaret() {
  const [shown, setShown] = useState(true);

  useEffect(() => {
    const blink = setInterval(() => setShown((wasShown) => !wasShown), CARET_BLINK_MS);
    return () => clearInterval(blink);
  }, []);

  return <View style={[styles.caret, !shown && styles.caretHidden]} />;
}

/**
 * What a seated phone is looking at, and the subscriptions every one of those
 * answers is read from.
 *
 * It draws nothing itself. There are three screens under here — the Host's
 * room, the Host's picker, and the one everybody else gets — and this is where
 * the choice between them is made, because all three stand on the same seat,
 * the same roster and the same running-game query, and a phone that moved
 * between them by remounting would drop all three.
 *
 * It is also where a relaunched app opens: the handoff's reconnect rule is that
 * a rejoining phone lands on the screen its room's phase calls for, which is
 * this decision and not a route.
 *
 * The standing is read from the live roster rather than from the answer that
 * seated this phone, so a player who becomes the host mid-party finds out here
 * — their screen changes under them, which is the whole reason the two host
 * screens are states of this one rather than somewhere the app navigates to.
 */
function YoureInScreen({
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
  // nobody on this phone caused — the Host ends the room or removes this
  // player, or a room everybody walked away from expires — and until this was
  // watched, none of them took the phone off a lobby that no longer existed.
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

  if (screen.kind === 'game') {
    return (
      <InGameScreen
        code={code}
        module={screen.module}
        state={screen.state}
        roster={roster}
        playerId={session.playerId}
        youAreHost={standing.youAreHost}
      />
    );
  }

  if (screen.kind === 'paused' || screen.kind === 'unavailable') {
    return (
      <GameRuntimeStatusScreen
        status={screen.kind}
        roster={roster}
        youAreHost={standing.youAreHost}
        onLeaving={noteLeaving}
        onLeaveFailed={noteStillHere}
        onLeft={onLeft}
      />
    );
  }

  // Everybody who is not running the room gets one screen and no controls.
  if (!standing.youAreHost) {
    return (
      <WaitingScreen
        standing={standing}
        browsing={browsing}
        roster={roster}
        onLeaving={noteLeaving}
        onLeaveFailed={noteStillHere}
        onLeft={onLeft}
      />
    );
  }

  // The room says it is playing something and `runningGameScreen` still sent
  // this phone to the lobby, so this build does not have the module. Read
  // before the picker, because a Host who was on the picker when the room was
  // handed to them mid-game must not be offered a Select for a room that is
  // already playing — see `stranded` on the room screen.
  const stranded = running !== null && running !== undefined && screen.kind === 'lobby';

  // The picker needs a card to draw. `browsing` is `undefined` only in a build
  // with no games at all, which is nothing to pick from — so that Host stays in
  // their room, where the count line and the roster are still true.
  if (picking && !stranded && browsing !== undefined) {
    return (
      <PickAGameScreen
        browsing={browsing}
        roster={roster}
        settingsChoice={settingsChoice}
        onChooseSetting={setSettingsChoice}
        onBack={() => setPicking(false)}
      />
    );
  }

  return (
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
  );
}

/**
 * A fail-closed game boundary. Paused and unavailable responses deliberately
 * carry no state, so this screen never mounts a game control or attempts to
 * guess what the missing state meant.
 */
function GameRuntimeStatusScreen({
  status,
  roster,
  youAreHost,
  onLeaving,
  onLeaveFailed,
  onLeft,
}: {
  readonly status: 'paused' | 'unavailable';
  readonly roster: readonly RosterSeat[];
  readonly youAreHost: boolean;
  readonly onLeaving: () => void;
  readonly onLeaveFailed: () => void;
  readonly onLeft: () => void;
}) {
  const paused = status === 'paused';

  return (
    <PhoneScreen>
      <RoomHeader
        trailing={
          <LeaveControl
            roster={roster}
            youAreHost={youAreHost}
            onLeaving={onLeaving}
            onLeaveFailed={onLeaveFailed}
            onLeft={onLeft}
          />
        }
      />
      <Text style={styles.title}>{paused ? 'TV disconnected' : 'Game unavailable'}</Text>
      <Text style={[styles.waitingFor, styles.asideCentred]}>
        {paused
          ? 'The game is paused while Huddle reconnects to the TV.'
          : 'Huddle could not safely read this game. Return to the lobby to continue.'}
      </Text>
      {youAreHost ? <BackToLobbyControl /> : null}
    </PhoneScreen>
  );
}

/**
 * Phone — the Host's room (the approved board's "Your room").
 *
 * Everything about the room and nothing about the games: who is in it, how many
 * that is, and the one control that moves on. The picker used to sit below this
 * on the same scroll, which is what made the roster — the section carrying news
 * nothing else in the product carries — the thing a Host scrolled past. Two
 * states, one screen (see `YoureInScreen`), and this is the one the Host is on
 * for as long as people are still arriving.
 *
 * The roster is drawn borderless with hairline rules between the rows, as the
 * board draws it. Soft Minimal gave each row its own bordered card on its own
 * shadow, which at ten players was ten objects stacked down a phone; a rule is
 * what says "these are one list" without spending a surface per person.
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
      <RoomHeader
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
function PickAGameScreen({
  browsing,
  roster,
  settingsChoice,
  onChooseSetting,
  onBack,
}: {
  readonly browsing: CarouselWindow;
  readonly roster: readonly RosterSeat[];
  readonly settingsChoice: SettingsChoice | undefined;
  readonly onChooseSetting: (next: (current: SettingsChoice | undefined) => SettingsChoice) => void;
  readonly onBack: () => void;
}) {
  const browseGame = useMutation(api.games.browseGame);
  const back = previousIndex(browsing.index);
  const on = nextIndex(browsing.index);
  // The Host's settings live on this phone and nowhere else — see
  // `settings-choice`. They travel as one argument of `startGame`, so browsing
  // stays exactly what it was before this screen gained settings: a mutation of
  // its own that the TV and every other phone follow, and that nothing here
  // touches.
  const { id: gameId } = browsing.focused.metadata;
  const { settingsSchema } = browsing.focused;

  async function browse(to: number | undefined) {
    if (to === undefined) {
      return;
    }

    const sessionToken = await phoneSessionTokenStore.read();

    if (sessionToken !== null) {
      await browseGame({ sessionToken, index: to });
    }
  }

  return (
    <PhoneScreen>
      <RoomHeader trailing={<OutlinePill label={BACK_TO_ROOM} onPress={onBack} />} />

      <Text style={styles.pickingLabel}>YOU’RE THE HOST — PICK A GAME</Text>

      <GameCard metadata={browsing.focused.metadata} />

      <View style={styles.pickerRow}>
        <RoundButton
          icon="chevron-left"
          spokenAs="Previous game"
          enabled={back !== undefined}
          onPress={() => void browse(back)}
        />
        <Text style={styles.pickedPosition}>
          {browsing.index + 1} / {browsing.total}
        </Text>
        <RoundButton
          icon="chevron-right"
          spokenAs="Next game"
          enabled={on !== undefined}
          onPress={() => void browse(on)}
        />
      </View>

      <Text style={[styles.aside, styles.asideCentred]}>
        Swipe or tap arrows — the TV follows along
      </Text>

      <SettingsControls
        schema={settingsSchema}
        gameId={gameId}
        choice={settingsChoice}
        // Chosen from the choice React holds rather than the one this render
        // closed over: two chips tapped in the same beat both count.
        onChoose={(key, value) =>
          onChooseSetting((current) => settingChosen(gameId, current, key, value))
        }
      />

      <StartGameControl
        roster={roster}
        browsingAt={browsing.index}
        settings={settingsToStart(settingsSchema, gameId, settingsChoice)}
      />
    </PhoneScreen>
  );
}

/**
 * Phone — everybody who is not running the room (the approved board's
 * "Waiting").
 *
 * The Host's face rather than the reader's own, because the sentence under it
 * names the Host: this screen is about the person the room is waiting on, and a
 * player looking at their own avatar over "Sam is choosing…" would be reading
 * two different people. Their own avatar is on the television, at the size the
 * room is actually looking at.
 *
 * There is nothing to press here *about the game*, which is most of the screen,
 * and the card at the foot is what says so out loud rather than leaving it as
 * an absence. The one control is Leave, in the header, where it is on every
 * other seated screen too.
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
      <RoomHeader
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
function RoomHeader({ trailing }: { readonly trailing: ReactNode }) {
  return (
    <View style={styles.seatedHeader}>
      <Wordmark height={20} />
      {trailing}
    </View>
  );
}

/** The `ROOM CODE` label and its letters, at the far end of the room's title row. */
function RoomCodeChip({ code }: { readonly code: string }) {
  return (
    <View style={styles.roomCode}>
      <Text style={styles.roomCodeLabel}>ROOM CODE</Text>
      <View style={styles.roomCodeLetters}>
        {[...code].map((letter, position) => (
          <View key={position} style={styles.roomCodeLetter}>
            <Text style={styles.roomCodeLetterText}>{letter}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * The browsed game, as the board's card: its key art filling a tall rounded
 * surface, with the title and the three facts over the foot of it.
 *
 * The art is the flat `keyArt.color` the module declares, which is what the
 * television's carousel draws too. The board shows a photographic render there;
 * wiring `game-art/` to a module is a change to `GameMetadata` and the plan puts
 * it out of scope for this pass, so the two surfaces stay in step at the
 * treatment they both currently have rather than one of them getting ahead.
 */
function GameCard({ metadata }: { readonly metadata: GameMetadata }) {
  const { title, keyArt, playerRange, estimatedMinutes, category } = metadata;

  return (
    <Surface
      elevation={elevation.phoneCard}
      style={[styles.stretch, styles.gameCard, { backgroundColor: colors[keyArt.color] }]}>
      <Text style={styles.gameCardTitle}>{title}</Text>

      <View style={styles.gameCardChips}>
        <GameCardChip icon="players" label={`${playerRange.min}–${playerRange.max} players`} />
        <GameCardChip icon="clock" label={`${estimatedMinutes} min`} />
        <GameCardChip icon="tag" label={category} />
      </View>
    </Surface>
  );
}

/** One fact about a game, on the card's own art. */
function GameCardChip({ icon, label }: { readonly icon: IconName; readonly label: string }) {
  return (
    <View style={styles.gameCardChip}>
      <View style={[StyleSheet.absoluteFill, styles.gameCardChipWash]} />
      <Icon name={icon} size={14} color={colors.ink} />
      <Text style={styles.gameCardChipText}>{label}</Text>
    </View>
  );
}

/**
 * This phone gives up its seat (the scope's "leave").
 *
 * It replaced End room, and it is a different kind of control: End room was the
 * Host's alone and deleted every seat in the room, where this deletes exactly
 * one — the reader's. So it is on every seated screen rather than the Host's,
 * and the confirm it stands behind warns about what the reader is giving up
 * instead of what is being done to everybody else.
 *
 * It keeps the header slot and the outlined pill the board draws, and it keeps
 * the confirm. A tap that costs a seat is still worth a second one — the room
 * has no undo, only a rejoin — but it is no longer the room's irreversible act,
 * because for everybody but the last player out it is not irreversible at all.
 */
function LeaveControl({
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
function OutlinePill({
  label,
  onPress,
}: {
  readonly label: string;
  readonly onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {({ pressed }) => (
        <View style={[styles.outlinePill, pressed && styles.buttonPressed]}>
          <Text style={styles.outlinePillText}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * The orange bar at the foot of a screen: the one thing that screen is for.
 *
 * Every screen in the Controller has exactly one, which is what makes it read
 * as the answer to "and then?" rather than as a button among buttons. The
 * trailing icon is optional and is only ever an arrow — a control that moves
 * the Host to another screen says so, and a control that commits the room does
 * not.
 */
function PrimaryButton({
  label,
  trailingIcon,
  enabled,
  onPress,
}: {
  readonly label: string;
  readonly trailingIcon?: IconName;
  readonly enabled: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.stretch}
      disabled={!enabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
    >
      {({ pressed }) => (
        <Surface
          elevation={elevation.phoneCard}
          // Dimming belongs to the whole surface: fading the face alone would
          // leave a solid shadow under a ghosted button.
          style={[[styles.stretch, !enabled && styles.buttonUnavailable], [styles.button, pressed && styles.buttonPressed]]}>
          <Text style={styles.buttonLabel}>{label}</Text>
          {trailingIcon === undefined ? null : (
            <Icon name={trailingIcon} size={20} color={colors.inverse} />
          )}
        </Surface>
      )}
    </Pressable>
  );
}

/**
 * The shell both host-confirm sheets wear: a centred Soft Minimal card floated over
 * an ink scrim, dismissed by a tap on the scrim, by the system back gesture, or
 * by the Cancel that always sits at its foot.
 *
 * The Manage Sheet fills it with a player and the powers over them; the End Room
 * sheet with what closing the room costs. Only their bodies differ, so only
 * their bodies are theirs — the surface, the scrim, the way out, and the Cancel
 * are one copy here. A change to how a confirm sheet dismisses, or the scrim it
 * floats over, reaches both rather than one, which is the whole of why it was
 * worth lifting out of the two.
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
 * What it warns depends on who is leaving (`leaveConsequence`), because leaving
 * is three different acts. Only the last player out is doing something
 * irreversible.
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
        accessibilityState={{ disabled: leaving }}
      >
        {({ pressed }) => (
          <Surface
            elevation={elevation.phoneSmall}
            style={[styles.stretch, [styles.button, pressed && styles.buttonPressed]]}>
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
 * Remove wears Soft Minimal's punch — the same "this ends something" face as Back
 * to lobby, and for the same reason: deleting a seat is not undone. Transfer is
 * the cobalt primary. A disabled transfer (an away target) keeps its place and
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
        accessibilityState={{ disabled: !pressable }}
      >
        {({ pressed }) => (
          <Surface
            elevation={elevation.phoneCard}
            style={[styles.stretch, [styles.button, face, pressed && styles.buttonPressed]]}>
            <Icon name={remove ? 'trash' : 'crown'} size={18} color={glyph} />
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
function SettingsControls({
  schema,
  gameId,
  choice,
  onChoose,
}: {
  readonly schema: GameSettingsSchema;
  readonly gameId: string;
  readonly choice: SettingsChoice | undefined;
  readonly onChoose: (key: string, value: string) => void;
}) {
  const controls = settingsControls(schema, gameId, choice);

  if (controls.length === 0) {
    return null;
  }

  return (
    <View style={styles.settings}>
      <Text style={styles.label}>SETTINGS</Text>

      {controls.map((control) => (
        <View key={control.key} style={styles.setting}>
          <Text style={styles.settingLabel}>{control.label}</Text>
          <View style={styles.settingOptions}>
            {control.options.map((option) => (
              <SettingOption
                key={option.value}
                label={option.label}
                // Which setting this value belongs to, for a screen reader —
                // three settings' chips are one flat list of buttons to it, and
                // "Movies, selected" alone says nothing about what it sets.
                spokenAs={`${control.label}: ${option.label}`}
                chosen={option.chosen}
                onPress={() => onChoose(control.key, option.value)}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * One value of one setting, as Soft Minimal draws a choice: the chosen chip is
 * cobalt and sits on its own shadow, the rest are white and flat.
 *
 * The same treatment the color picker gives a claimed swatch, for the same
 * reason — the sticker shadow is what Soft Minimal uses to lift the thing that is
 * currently true off the ones that merely could be.
 */
function SettingOption({
  label,
  spokenAs,
  chosen,
  onPress,
}: {
  readonly label: string;
  /** The label read aloud: the setting this value belongs to, and the value. */
  readonly spokenAs: string;
  readonly chosen: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={spokenAs}
      accessibilityState={{ selected: chosen }}
    >
      {({ pressed }) =>
        chosen ? (
          <Surface
            elevation={elevation.phoneSmall}
            style={[
              styles.settingOption,
              styles.settingOptionChosen,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={[styles.settingOptionLabel, styles.settingOptionLabelChosen]}>
              {label}
            </Text>
          </Surface>
        ) : (
          // No press travel on the flat chip, as with an unclaimed swatch:
          // Soft Minimal's press is a sticker going down onto its own shadow, and
          // a chip that has no shadow to meet would just slide 3px sideways.
          <View style={styles.settingOption}>
            <Text style={styles.settingOptionLabel}>{label}</Text>
          </View>
        )
      }
    </Pressable>
  );
}

/**
 * One of the picker's round buttons.
 *
 * The chevron is an icon rather than a `‹` typed in the body face, which is
 * what it was: a glyph borrowed from a text font is whatever weight and
 * optical centre that font happens to give it, and it drifted from the arrow
 * beside it on the primary button. Both are now the same drawing at two sizes.
 *
 * It carries its own spoken name because the glyph is the whole control — there
 * is no text beside it to read instead.
 */
function RoundButton({
  icon,
  spokenAs,
  enabled,
  onPress,
}: {
  readonly icon: IconName;
  readonly spokenAs: string;
  readonly enabled: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      disabled={!enabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={spokenAs}
      accessibilityState={{ disabled: !enabled }}
    >
      {({ pressed }) => (
        <Surface
          elevation={elevation.phoneSmall}
          style={[enabled ? undefined : styles.buttonUnavailable, [styles.roundButton, pressed && styles.buttonPressed]]}>
          <Icon name={icon} size={26} color={colors.ink} />
        </Surface>
      )}
    </Pressable>
  );
}

/**
 * Which seats this phone has watched arrive, folded from the roster snapshots
 * the subscription pushes.
 *
 * The television's own hook, on the phone now that the Host's roster draws the
 * JUST JOINED chip too. Folded during render and stored, so it settles rather
 * than loops: `noteArrivals` hands back the identical value whenever a snapshot
 * seats nobody, which is most of them.
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
function StartGameControl({
  roster,
  browsingAt,
  settings,
}: {
  readonly roster: readonly RosterSeat[];
  readonly browsingAt: number;
  /** What the controls above are showing: the settings the room starts on. */
  readonly settings: GameSettings;
}) {
  const startGame = useMutation(api.games.startGame);
  const [starting, setStarting] = useState(false);
  const [failure, setFailure] = useState<string>();
  const control = startControl(roster, browsingAt);

  async function start() {
    setStarting(true);
    setFailure(undefined);

    try {
      const sessionToken = await phoneSessionTokenStore.read();

      if (sessionToken === null) {
        setFailure('This phone has lost its seat — reopen the app to rejoin.');
        return;
      }

      const game = gameToStart(browsingAt);

      if (game !== undefined) {
        await startGame({ sessionToken, gameId: game.id, settings });
      }
    } catch (error) {
      setFailure(lifecycleFailureMessage(error));
    } finally {
      setStarting(false);
    }
  }

  const pressable = control.enabled && !starting;

  return (
    <View style={styles.field}>
      <Pressable
        style={styles.stretch}
        disabled={!pressable}
        onPress={() => void start()}
        accessibilityRole="button"
        accessibilityState={{ disabled: !pressable }}
      >
        {({ pressed }) => (
          <Surface
            elevation={elevation.phoneCard}
            style={[[styles.stretch, !control.enabled && styles.buttonUnavailable], [styles.button, pressed && styles.buttonPressed]]}>
            <Text style={styles.buttonLabel}>
              {starting ? 'Starting…' : control.label}
            </Text>
          </Surface>
        )}
      </Pressable>

      {control.blockedBecause === undefined ? null : (
        <Text style={styles.waitingFor}>{control.blockedBecause}</Text>
      )}

      {failure === undefined ? null : (
        <Text style={styles.failure} accessibilityLiveRegion="polite">
          {failure}
        </Text>
      )}
    </View>
  );
}

/**
 * The phone while a game is running: the game's own screen, and — for the Host
 * — the way back to the lobby.
 *
 * The frame around the module is the hub's and says only what `GameMetadata`
 * already told it, which is the point: this screen does not know what game it
 * is drawing — nor which beat of it the player is on, which is why the Host's
 * control below reads the same on all of them.
 */
function InGameScreen({
  code,
  module,
  state,
  roster,
  playerId,
  youAreHost,
}: {
  readonly code: string;
  readonly module: GameModule;
  readonly state: unknown;
  readonly roster: readonly RosterSeat[];
  readonly playerId: PlayerSession['playerId'];
  readonly youAreHost: boolean;
}) {
  const players = gamePlayersFrom(roster);
  const player = players.find((seated) => seated.playerId === playerId);

  return (
    <PhoneScreen>
      <View style={styles.seatedHeader}>
        <Wordmark height={16} />
        <View style={styles.seatedHeaderEnd}>
          {/* The Host's mark mid-game is the crown alone. The word belongs to
              the roster, where it labels a row among rows; here there is one
              player on the screen and the glyph is the whole of the news. */}
          {youAreHost ? (
            <Icon name="crown" size={18} color={colors.accent} label="You are the host" />
          ) : null}
          <Surface elevation={elevation.phoneSmall} style={styles.codeChip}>
            <Text style={styles.codeChipText}>{code}</Text>
          </Surface>
        </View>
      </View>

      <Text style={styles.title}>{module.metadata.title}</Text>

      {/* The roster is a subscription and this player's seat can be a beat
          behind it — but a game screen is drawn *for* somebody, so it waits for
          the seat rather than inventing one. */}
      {player === undefined ? null : (
        <PlayerGameScreen module={module} state={state} player={player} />
      )}

      {youAreHost ? <BackToLobbyControl /> : null}
    </PhoneScreen>
  );
}

/**
 * The module's Controller screen, mounted on the state the room stored.
 *
 * `sendEvent` is the phone's way of telling the room what its player did. It is
 * fire-and-forget on purpose: the answer a player just gave comes back through
 * the room's own subscription, the same round trip the color swatches wait for,
 * so there is nothing here for the screen to wait on and nothing local to keep
 * in step. What the phone draws is always what the room says, never what this
 * phone hopes it said.
 *
 * A failure is swallowed rather than shown. Every refusal a game event can meet
 * is either the room having moved on — a beat the player can see for themselves
 * on the television — or this phone having lost its seat, which the screen
 * behind this one is already saying. An error card over four answer buttons
 * would interrupt the game to report something that no longer matters.
 */
function PlayerGameScreen({
  module,
  state,
  player,
}: {
  readonly module: GameModule;
  readonly state: unknown;
  readonly player: GamePlayer;
}) {
  const sendGameEvent = useMutation(api.games.sendEvent);

  function send(event: GameEvent) {
    void (async () => {
      try {
        const sessionToken = await phoneSessionTokenStore.read();

        if (sessionToken === null) {
          return;
        }

        await sendGameEvent({ sessionToken, event });
      } catch {
        // Deliberately silent — see above.
      }
    })();
  }

  // Mounted as a component rather than called as a function. The screen owns
  // hooks now (trivia's reveal beat), and calling it would register them on
  // this component's hook list instead of its own — making hook count a hidden
  // contract between the hub and every game it installs.
  const Controller = module.screens.controller;

  return (
    <View style={styles.gameStage}>
      <Controller state={state} player={player} sendEvent={send} />
    </View>
  );
}

/**
 * Back to lobby: the Host's way out of a running game, with
 * the room and its roster intact.
 *
 * On every beat the Host can be on, and deliberately: the room's other way
 * forward is the Reveal Beat, which comes from the phones, so a room whose
 * phones have all gone quiet has nothing left that can move it. This is the only
 * thing that can, and a control that only appeared once the game was over would
 * not be there for the beat that needs it.
 *
 * It keeps the punch face it wore as "End game", because on all but the last
 * beat it is still throwing away a game in progress — what changed is the word,
 * which now says where the room goes rather than mis-stating what it is doing
 * (see `backToLobbyLabel`). The roster, the Host and the Room Code survive it;
 * only the game's own state, the scoreboard included, is left behind.
 */
function BackToLobbyControl() {
  const endGame = useMutation(api.games.endGame);
  const [returning, setReturning] = useState(false);
  const [failure, setFailure] = useState<string>();

  async function backToLobby() {
    setReturning(true);
    setFailure(undefined);

    try {
      const sessionToken = await phoneSessionTokenStore.read();

      if (sessionToken === null) {
        setFailure('This phone has lost its seat — reopen the app to rejoin.');
        return;
      }

      await endGame({ sessionToken });
    } catch (error) {
      setFailure(lifecycleFailureMessage(error));
    } finally {
      setReturning(false);
    }
  }

  return (
    <View style={styles.field}>
      <Pressable
        style={styles.stretch}
        disabled={returning}
        onPress={() => void backToLobby()}
        accessibilityRole="button"
        accessibilityState={{ disabled: returning }}
      >
        {({ pressed }) => (
          <Surface
            elevation={elevation.phoneCard}
            style={[styles.stretch, [styles.button, styles.backToLobbyButton, pressed && styles.buttonPressed]]}>
            <Text style={styles.buttonLabel}>{backToLobbyLabel(returning)}</Text>
          </Surface>
        )}
      </Pressable>

      {failure === undefined ? null : (
        <Text style={styles.failure} accessibilityLiveRegion="polite">
          {failure}
        </Text>
      )}
    </View>
  );
}

/**
 * Who else is in the room, live.
 *
 * The seated screen subscribes to the same roster the TV draws its seats from,
 * because everything on it that can change without this phone doing anything is
 * on that one query: who is running the room, who has gone quiet, and who has
 * just walked in. So a handover and an arrival across the room both land as a
 * push, within a round trip of the room deciding them, rather than at the next
 * launch.
 *
 * **The unanswered moment is handed on rather than flattened**, which is the
 * whole reason this returns what it does. Every consumer that merely draws the
 * room wants an empty list as its neutral — no host to name, nobody to count —
 * but `useArrivals` has to tell "the room is empty" from "nobody has said yet",
 * and `[]` makes those the same snapshot. Fold `[]` as the baseline and the
 * first real answer reads as ten people walking in at once, which is precisely
 * the thing `just-joined.ts` exists to refuse. The television keeps the same
 * split for the same reason.
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

/**
 * This phone's Session Token, once the keystore has answered.
 *
 * `undefined` until it has. Every other use of the token is inside an effect
 * that reads it at the moment it acts (`keepPresent`, and the mutations' own
 * handlers), which is what keeps a credential out of this screen's state — but a
 * subscription cannot be written that way: `games.running` and `players.session`
 * both send it as an argument, so it has to be a value the render already holds.
 *
 * What it buys is the phone seeing *its own* answer in a state the room hides
 * the rest of (see `redactStateFor`), and knowing when its seat has ended. Both
 * subscriptions wait for it rather than asking once without it and again with
 * it, because a subscription is keyed by its arguments and the gap between two
 * keyings reads as "no answer yet" — which on the game query is the lobby. So a
 * screen still waiting on the keystore draws nothing of the room rather than
 * briefly drawing the wrong thing about it.
 *
 * Where it can still show through: a keystore that never answers leaves this
 * phone a viewer the room cannot name for the life of the screen — its own
 * locked-in button included. That is the same device `alsoInMemory` is written
 * for, and the same phone that would have failed to rejoin at launch.
 */
function useSessionToken(): string | undefined {
  const [sessionToken, setSessionToken] = useState<string>();

  useEffect(() => {
    let listening = true;

    phoneSessionTokenStore
      .read()
      .then((stored) => {
        if (listening && stored !== null) {
          setSessionToken(stored);
        }
      })
      // A keystore that will not answer is the case `alsoInMemory` exists for,
      // and it is already survivable: this phone is simply a viewer the room
      // cannot name, which is the television's view. Swallowed rather than left
      // to an unhandled rejection, which is noise nobody can act on.
      .catch(() => undefined);

    return () => {
      listening = false;
    };
  }, []);

  return sessionToken;
}

/**
 * Says this phone is still here, for as long as its owner is on a screen that
 * holds a seat — the green dot on the TV's roster is the room repeating it back.
 *
 * It hangs off the seated screen rather than the app's root because holding a
 * seat is exactly the condition: a phone on the join form has nothing to be
 * present as. The token is read from the keystore inside `keepPresent`, which
 * is what keeps it out of this screen's state (see `resumeSession`).
 */
function useHeartbeat(): void {
  const heartbeat = useMutation(api.players.heartbeat);

  useEffect(
    () =>
      keepPresent(
        phoneSessionTokenStore,
        (sessionToken) => heartbeat({ sessionToken }),
        watchAppForeground,
      ),
    [heartbeat],
  );
}

// Where the phone's measurements come from, which is now two places.
//
// The older entries below are the Soft Minimal handoff's own numbers for phone
// screens (§2, §4) and still say so on the line. Everything Soft Minimal added
// — the roster's slots, the room's title row, the game card, the waiting screen
// — is measured off the approved boards in `docs/design/reference/screens/`
// instead, because those screens have no § to be measured against: the board
// draws surfaces the old spec never had.
const styles = StyleSheet.create({
  heading: {
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: colors.ink,
    fontFamily: fontFamily.bold,
    fontSize: 28,
    // Inter's line box runs taller than its caps; pinning it keeps the
    // heading's own spacing rather than the font's.
    lineHeight: 34,
    textAlign: 'center',
  },

  field: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 10,
  },
  // A measurement the handoff gives and this screen does not take, twice over.
  // Soft Minimal wrote this label at 13 against a floor of 14; Soft Minimal writes
  // it at 13 against a floor of 12. Either way the answer is the token and not
  // a number: a floor a single spec line can undercut is not a floor, and a
  // bare literal here would read as a measurement rather than as the rule being
  // obeyed. It moves when `minBodyFontSize` does, which is the point.
  label: {
    alignSelf: 'flex-start',
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: minBodyFontSize.phone,
    letterSpacing: letterSpacing.label,
  },

  tiles: {
    flexDirection: 'row',
    gap: 12,
  },
  tile: {
    width: 64,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    // Every state carries the same border width, so a cell filling in never
    // nudges the letter beside it.
    borderWidth: borderWidth.hairline,
    // Proportional to the TV tile's 24px on 148px, so the phone's smaller tile
    // reads as the same object (handoff: 10–16px on small elements).
    borderRadius: radius.chip,
  },
  tileActive: {
    borderColor: colors.ink,
  },
  tileEmpty: {
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  tileLetter: {
    // As on the TV's tiles, and for the same reason there: a Room Code letter
    // takes its box from its cell, never from its own glyph. These cells cannot
    // blank the way the TV's did — an empty one renders a caret or nothing at
    // all, never an empty `<Text>`, so they never file the measurement that
    // poisons an I — but the rule is the rule, and one of them keeping it by
    // accident is not worth the difference.
    ...codeLetterBox,
    color: colors.ink,
    fontFamily: fontFamily.semibold,
    fontSize: 36,
    // As on the TV's tiles: the line box is taller than the caps unless it is
    // pinned to the cap height.
    lineHeight: 40,
  },
  caret: {
    width: 3,
    height: 36,
    backgroundColor: colors.accent,
  },
  caretHidden: {
    opacity: 0,
  },
  // Invisible, and over the whole row: a tap anywhere on the tiles raises the
  // keyboard, and what is typed lands in the one field that holds the code.
  codeInput: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0,
  },

  // A Surface wrapper sits between a full-width surface and its parent,
  // so the stretch has to be asked for on the wrapper as well as the surface —
  // otherwise the wrapper shrink-wraps and the card stops filling the column.
  stretch: {
    alignSelf: 'stretch',
  },

  nameField: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.input,
  },
  nameInput: {
    // 50 inside the wrapper's two 3px borders is the handoff's 56px field.
    minHeight: 50,
    paddingHorizontal: 18,
    // Android gives a TextInput its own vertical padding; the wrapper owns the
    // height here, so the field is centred in it rather than pushed off centre.
    paddingVertical: 0,
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: 18,
  },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    // The gap a button with an icon needs, and nothing on one without: an empty
    // flex gap costs a button with a single label nothing.
    gap: 10,
    minHeight: 56,
    backgroundColor: colors.accent,
    borderColor: colors.ink,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.button,
  },
  buttonUnavailable: {
    opacity: opacity.unavailable,
  },
  // Soft Minimal's press: the button travels into its own shadow. The shadow is a
  // rectangle sitting still behind it, so moving the face is the whole effect —
  // what shows past the edge shortens by exactly as far as the button went, and
  // no second shadow value has to be kept in step with this one.
  buttonPressed: {
    transform: [{ translateX: PRESS_TRAVEL }, { translateY: PRESS_TRAVEL }],
  },
  buttonLabel: {
    color: colors.surface,
    fontFamily: fontFamily.semibold,
    fontSize: 18,
  },
  failure: {
    alignSelf: 'stretch',
    color: colors.accent,
    fontFamily: fontFamily.medium,
    fontSize: 15,
    lineHeight: 20,
  },

  // The seat-loss notice under the heading. Ink rather than punch: a removed or
  // closed-out player is being told what happened, not warned off a mistake, so
  // it reads as the form's own line and not as the red a rejection wears.
  notice: {
    alignSelf: 'stretch',
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
  },

  seatedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
  },
  // The pill and the code chip travel together at the header's right end, so
  // the row stays a logo and a status group however many badges land in it.
  seatedHeaderEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  codeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.chip,
  },
  codeChipText: {
    color: colors.ink,
    fontFamily: fontFamily.semibold,
    fontSize: 20,
    letterSpacing: letterSpacing.roomCode,
    // The room-code chip's letter spacing trails the last letter too; pulling
    // it back keeps the text optically centred in the chip.
    marginRight: -letterSpacing.roomCode,
  },

  // The join form's avatar grid: four across, which is what makes ten read as
  // two full rows and a pair rather than an arbitrary heap. Capped at exactly
  // four tiles and three gaps and centred, so the column count is arithmetic
  // rather than whatever the phone's width happens to allow — see AVATAR_TILE.
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: AVATAR_GAP,
    maxWidth: AVATAR_COLUMNS * AVATAR_TILE + (AVATAR_COLUMNS - 1) * AVATAR_GAP,
  },
  // The chosen one: the accent, and a border rather than a tint, because the
  // artwork already fills the tile.
  avatarChosen: {
    borderColor: colors.accent,
    borderWidth: borderWidth.focus,
  },
  // The tick on the chosen tile's shoulder, half off the corner so it reads as
  // a mark applied to the tile rather than a badge drawn inside it.
  avatarTick: {
    position: 'absolute',
    top: -6,
    right: -6,
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    backgroundColor: colors.accent,
    borderColor: colors.canvas,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.pill,
  },

  // The Host's roster. No gap: the rows are one list and the rule between them
  // is what says so, which only works if they are actually touching.
  roster: {
    alignSelf: 'stretch',
  },
  // The board's row: no surface, no border, no shadow — a face, a name and the
  // slot, on the canvas. Ten of these is a list; ten bordered cards on ten
  // shadows was ten objects.
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 12,
    paddingVertical: 12,
  },
  // The hairline between two rows, drawn as the lower row's top edge so it can
  // never be orphaned under the last one.
  rosterRowRuled: {
    borderTopColor: colors.border,
    borderTopWidth: borderWidth.hairline,
  },
  // "(You)" on the Host's own row, muted so the name still reads as the name.
  rosterYou: {
    color: colors.mutedText,
  },
  // Soft Minimal's treatment for something present but not available, which is
  // exactly what an away player is. The circle only: see `rosterNameAway`.
  rosterAway: {
    opacity: opacity.unavailable,
  },
  rosterName: {
    flex: 1,
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: 16,
  },
  // The nickname mutes rather than dimming with the circle — ink at 30% stops
  // being text, which is the away-badge task's own measurement.
  rosterNameAway: {
    color: colors.mutedText,
  },

  // The manage sheet (task 3.7): a centred confirm dialog over a dimmed room.
  // Centred rather than a bottom sheet so it clears the home indicator without
  // this screen reaching for the safe area the Modal renders outside of.
  sheetRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  // Soft Minimal's scrim: ink pulled back to a wash, so the room reads as still
  // there behind the dialog. A separate view from the panel, which is its
  // sibling and so keeps its full-strength surface.
  sheetScrim: {
    backgroundColor: colors.ink,
    opacity: opacity.scrim,
  },
  sheetWrapper: {
    alignSelf: 'stretch',
  },
  sheet: {
    alignSelf: 'stretch',
    gap: 14,
    padding: 20,
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.card,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetName: {
    flex: 1,
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: 20,
  },
  // The end-room sheet's own title: `sheetName` is a row item beside an avatar
  // and stretches to fill it, which is not what a heading on its own line does.
  sheetTitle: {
    alignSelf: 'stretch',
    color: colors.ink,
    fontFamily: fontFamily.semibold,
    fontSize: 20,
  },
  // What ending the room costs, said before it is done. Body text, so it is read
  // at the phone floor rather than at the heading's size.
  sheetBody: {
    alignSelf: 'stretch',
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: minBodyFontSize.phone,
    lineHeight: 20,
  },
  sheetCancel: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  sheetCancelLabel: {
    color: colors.mutedText,
    fontFamily: fontFamily.semibold,
    fontSize: 16,
  },
  // Soft Minimal's aside on a phone screen: something true about the room rather
  // than something to press — §5's count line, §7's swipe hint, §8's caption.
  // One entry rather than three near-copies, each of whose comment claimed to
  // be a copy of one of the others.
  aside: {
    alignSelf: 'stretch',
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: 15,
  },
  // §7's hint and §8's caption sit under centred content; §5's count line sits
  // under a list of left-aligned rows and stays with them.
  asideCentred: {
    textAlign: 'center',
  },

  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    gap: 12,
  },
  // The board's round buttons. 56 rather than the handoff's 76: they used to
  // hold a 30pt glyph typed in the body face and now hold a 26pt drawing, and
  // 76 around that is a button mostly made of nothing.
  roundButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.pill,
  },
  // Where in the list the card is, between the arrows. The board draws it at
  // the weight of a heading rather than as an aside — it is the one thing on
  // the screen that says the picker has more than one thing in it.
  pickedPosition: {
    color: colors.ink,
    fontFamily: fontFamily.semibold,
    fontSize: 26,
  },
  // The settings group sits between the picker and the start button, and is
  // left-aligned rather than centred like the picker above it: the chips wrap
  // onto as many rows as the game's options need, and a wrapped row that
  // centres itself reads as a different list from the one above it.
  settings: {
    alignSelf: 'stretch',
    gap: 14,
  },
  setting: {
    alignSelf: 'stretch',
    gap: 8,
  },
  settingLabel: {
    color: colors.ink,
    fontFamily: fontFamily.semibold,
    fontSize: 16,
  },
  settingOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  settingOption: {
    justifyContent: 'center',
    // A comfortable thumb target on the smallest phone Huddle draws on.
    minHeight: 44,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    // Thin, as Soft Minimal borders a chip — these sit inside the picker's own
    // 3px surfaces and would out-weigh them at the same width.
    borderWidth: borderWidth.hairline,
    borderRadius: radius.chip,
  },
  settingOptionChosen: {
    backgroundColor: colors.accent,
  },
  settingOptionLabel: {
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: 15,
  },
  settingOptionLabelChosen: {
    color: colors.surface,
    fontFamily: fontFamily.semibold,
  },

  // Soft Minimal's "this ends something" surface, and the only punch button on a
  // phone screen — it is meant to be found, not stumbled into.
  backToLobbyButton: {
    backgroundColor: colors.accent,
  },
  waitingFor: {
    alignSelf: 'stretch',
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  // Where the module draws. It claims the room left on the screen so a game can
  // fill it, and stays out of the way of a game that draws nothing yet.
  gameStage: {
    alignSelf: 'stretch',
    flex: 1,
  },
  statusDot: {
    width: 12,
    height: 12,
    backgroundColor: colors.online,
    borderRadius: radius.pill,
  },

  // ————— The Host's room —————

  // "Your room" and the code, on one line with the title's baseline. The code
  // is the thing a latecomer is being read off somebody's screen, so it keeps
  // the far end rather than sitting under the title where the roster starts.
  roomTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    gap: 12,
  },
  roomCode: {
    alignItems: 'center',
    gap: 4,
  },
  roomCodeLabel: {
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: minBodyFontSize.phone,
    letterSpacing: letterSpacing.label,
    marginRight: -letterSpacing.label,
  },
  roomCodeLetters: {
    flexDirection: 'row',
    gap: 4,
  },
  // One boxed letter each, as the board draws it and as the television does:
  // a Room Code is read out loud a letter at a time, and four separated boxes
  // is what stops "HUDD" being read as a word.
  roomCodeLetter: {
    minWidth: 24,
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 3,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.chip,
  },
  roomCodeLetterText: {
    ...codeLetterBox,
    color: colors.ink,
    fontFamily: fontFamily.semibold,
    fontSize: 18,
    lineHeight: 22,
  },

  // The count line under the roster, with the dot the board puts on it.
  countLine: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 10,
  },

  // The header's outlined pill — Leave on the room and the waiting screen, the
  // way back on the picker.
  outlinePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderColor: colors.accent,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.pill,
  },
  outlinePillText: {
    color: colors.accent,
    fontFamily: fontFamily.semibold,
    fontSize: 15,
  },

  // ————— The roster's right-hand slots —————

  // The Host: the word and the crown, in the accent. Not a filled pill — the
  // accent is the system's one colour and a solid one here would out-shout the
  // primary button at the foot of the same screen.
  hostSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hostSlotText: {
    color: colors.accent,
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    letterSpacing: letterSpacing.label,
    marginRight: -letterSpacing.label,
  },
  // The system's one informational blue, and the only chip in the product with
  // a border of its own colour: it is news, and it is gone in four seconds, so
  // it has to be findable in a column of dots without being alarming.
  justJoinedChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderColor: colors.justJoined,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.chip,
  },
  // At the floor rather than under it. The board draws this chip smaller than
  // every other word on the screen, and the smallest the phone is allowed to
  // draw body text is 12 — so the floor wins and the chip is a point wider than
  // the board. Written as the token for the reason the field label is: a bare
  // 12 would read as a measurement rather than as a rule being obeyed.
  justJoinedText: {
    color: colors.justJoined,
    fontFamily: fontFamily.semibold,
    fontSize: minBodyFontSize.phone,
    letterSpacing: letterSpacing.label,
    marginRight: -letterSpacing.label,
  },
  awaySlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  awayText: {
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: 15,
  },

  // ————— The picker —————

  pickingLabel: {
    color: colors.accent,
    fontFamily: fontFamily.semibold,
    fontSize: minBodyFontSize.phone,
    letterSpacing: letterSpacing.label,
    marginRight: -letterSpacing.label,
    textAlign: 'center',
  },
  // The board's tall card. `aspectRatio` rather than a height, so it is the
  // same shape on a small phone and a large one instead of the same number of
  // points on both.
  gameCard: {
    aspectRatio: 1,
    justifyContent: 'flex-end',
    gap: 12,
    padding: 20,
    borderRadius: radius.card,
  },
  gameCardTitle: {
    color: colors.inverse,
    fontFamily: fontFamily.bold,
    fontSize: 30,
    lineHeight: 36,
    textAlign: 'center',
  },
  gameCardChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  // On the art rather than beside it, so its fill is the inverse at a wash — a
  // solid white chip here punches a hole in the card. The wash is a view of its
  // own beneath the contents rather than an `opacity` on the chip, which would
  // fade the icon and the word along with the fill and leave neither legible
  // against the art they are on.
  gameCardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.chip,
  },
  gameCardChipWash: {
    backgroundColor: colors.inverse,
    borderRadius: radius.chip,
    opacity: opacity.chipOnArt,
  },
  gameCardChipText: {
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: 13,
  },

  // ————— Waiting —————

  // The green-washed chip the board draws under the hero. It is not the lobby's
  // status card: there is no border and no shadow, because nothing on this
  // screen is a surface the reader can act on.
  nowViewing: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: colors.soft,
    borderRadius: radius.row,
  },
  // What this phone is about to become, said out loud because the screen is
  // otherwise an absence of controls.
  explainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderColor: colors.border,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.row,
  },
  explainerText: {
    flex: 1,
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: 16,
    lineHeight: 22,
  },

  // ————— The manage sheet's target —————

  sheetState: {
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: 16,
  },
  // The clock on the away face's shoulder.
  sheetAwayBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    padding: 5,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.pill,
  },

  // ————— Button faces —————

  // A control that cannot be pressed: the board's soft fill and muted ink,
  // rather than the 30% dim, which is the treatment for something present but
  // unavailable and reads on a button as "orange, but faint".
  buttonInert: {
    backgroundColor: colors.border,
    borderColor: colors.border,
  },
  buttonLabelInert: {
    color: colors.mutedText,
  },
  // The second action on a surface that already has a primary one.
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  buttonLabelSecondary: {
    color: colors.ink,
  },
  statusText: {
    flex: 1,
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: 16,
    lineHeight: 22,
  },
});
