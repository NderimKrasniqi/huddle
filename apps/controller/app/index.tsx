import { api } from '@huddle/convex';
import {
  gamePlayersFrom,
  type GameEvent,
  type GameModule,
  type GamePlayer,
  type GameSettings,
  type GameSettingsSchema,
  type PlayerColorName,
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
  codeLetterColor,
  colors,
  fontFamily,
  letterSpacing,
  minBodyFontSize,
  opacity,
  type PlayerColor,
  playerColor,
  playerFace,
  playerInitials,
  radius,
  shadowDepth,
} from '@huddle/ui';
import { StickerSurface } from '@huddle/ui/native';
import { useConvex, useMutation, useQuery } from 'convex/react';
import { useLocalSearchParams } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  activeCodeCell,
  canJoin,
  codeEntry,
  isCodeComplete,
  nicknameEntry,
  shouldMoveToNickname,
} from '../src/join-entry';
import { pickerSwatches, type SwatchState, yourColor } from '../src/color-picker';
import { claimFailureMessage, rejectionMessage } from '../src/color-rejection';
import { hostControlFailureMessage, hostControlRejectionMessage } from '../src/host-control-rejection';
import {
  type HostControlAction,
  type RosterRowControl,
  rosterRowControls,
  rosterRowIsManageable,
} from '../src/host-controls';
import {
  backToLobbyLabel,
  browsedGameMeta,
  END_ROOM,
  gameToStart,
  NOW_VIEWING_CAPTION,
  nowViewingLine,
  startControl,
} from '../src/game-controls';
import { lifecycleFailureMessage } from '../src/game-rejection';
import { lobbyStanding, lobbyStatusText, type RosterSeat } from '../src/host';
import { rosterFooterLine, rosterRowSlot, rosterRowSpokenAs } from '../src/host-roster';
import { joinFailureMessage } from '../src/join-rejection';
import { PhoneScreen } from '../src/phone-screen';
import {
  recallIdentity,
  rememberColor,
  rememberName,
} from '../src/identity';
import { phoneIdentityStore } from '../src/identity-store';
import { type ForegroundWatch, keepPresent } from '../src/presence';
import {
  joinScreenState,
  type PlayerSession,
  rememberSession,
  resumeSession,
} from '../src/session';
import { phoneSessionTokenStore } from '../src/session-store';
import { seatLossNotice } from '../src/seat-loss';
import {
  type SettingsChoice,
  settingChosen,
  settingsControls,
  settingsToStart,
} from '../src/settings-choice';

/** How long the caret in the active cell rests between showing and hiding. */
const CARET_BLINK_MS = 530;

/** How far a pressed button travels into its own shadow. */
const PRESS_TRAVEL = 2;

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
 * The Controller's first screen (docs/design/design-handoff.md §2 and §4): the
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

  const state = joinScreenState(session, linkedCode ?? '');

  if (state.kind === 'restoring') {
    // Nothing yet — the launch is already blank behind the root layout's font
    // gate, on a window painted the Boardwalk canvas. Drawing the join form
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
      const { sessionToken, ...seat } = await joinRoom({ code, nickname: claimed });
      await rememberSession(phoneSessionTokenStore, sessionToken);
      // The name that just worked, so the next visit opens with it. A courtesy,
      // not a credential — it never blocks the seat this join already won.
      void rememberName(phoneIdentityStore, claimed);
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
        <Text style={styles.logo}>
          HUDDLE<Text style={styles.logoPeriod}>.</Text>
        </Text>
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
        {/* The Boardwalk surface is the wrapper's, not the field's: the shadow
            is cast by a view, and a TextInput owns its own text box. */}
        <StickerSurface
          depth={shadowDepth.phoneSmall}
          style={styles.nameField}
          wrapperStyle={styles.stretch}
        >
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
        </StickerSurface>
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
            <StickerSurface
              depth={shadowDepth.phoneCard}
              style={[styles.button, pressed && styles.buttonPressed]}
              // Dimming belongs to the whole sticker: fading the face alone
              // would leave a solid shadow under a ghosted button.
              wrapperStyle={[styles.stretch, !ready && styles.buttonUnavailable]}
            >
              <Text style={styles.buttonLabel}>{joining ? 'Joining…' : 'Join →'}</Text>
            </StickerSurface>
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
 * their Boardwalk colors, a cobalt cell with a blinking caret where the next
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
                <Text style={[styles.tileLetter, { color: codeLetterColor(position) }]}>
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
 * The room's answer (handoff §4): the code they are in, their avatar, and their
 * name in the room's own words. It is also where a relaunched app opens — the
 * handoff's reconnect rule is that a rejoining phone lands on the screen its
 * room's phase calls for, and in the lobby that is this one.
 *
 * The Host gets the pill, a line saying the room is theirs, and then the whole
 * of §5 and §7 below it — the roster and the picker, which are sections of this
 * screen rather than screens of their own (see `LobbyGameControls`). So this is
 * where a player finds out they are running the room, including when they
 * become the host mid-party, which is why the standing is read from a live
 * query rather than from the answer that seated them.
 */
function YoureInScreen({
  session,
  onSeatLost,
}: {
  readonly session: PlayerSession;
  readonly onSeatLost: (reason: string) => void;
}) {
  const { code, nickname } = session;
  useHeartbeat();
  const roster = useRoomRoster(session);
  const standing = lobbyStanding(roster, session.playerId);
  const claimed = yourColor(roster, session.playerId);
  const face = playerFace(claimed);
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
  // starts into a room mid-game would flash that lobby, which on the Host's
  // phone is the one carrying End room. One subscription, with its final
  // arguments, cannot.
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

  useEffect(() => {
    if (seat === null) {
      // The roster read in the same render is the room as it was the instant the
      // seat vanished — still peopled if the Host removed this one player, empty
      // if the room itself ended — which is how the notice tells the two apart.
      onSeatLost(seatLossNotice(roster));
    }
  }, [seat, onSeatLost, roster]);
  const screen = runningGameScreen(running);

  // The card the room is browsing. Held here rather than by the controls that
  // draw it because §5's roster reads it too — its footer line only offers to
  // start when the room in fact can, which is a question about the card — and
  // the roster sits above the color picker while the controls sit below it. One
  // subscription answering both is what keeps the two sections from disagreeing
  // about whether the party can begin.
  const browsingAt = useQuery(api.games.browsing, { roomId: session.roomId });
  const browsing = carouselWindow(browsingAt ?? 0);

  if (screen.kind === 'unknownGame') {
    return (
      <UnknownGameScreen code={code} gameId={screen.gameId} youAreHost={standing.youAreHost} />
    );
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

  return (
    <PhoneScreen>
      <View style={styles.seatedHeader}>
        <Text style={styles.logoSmall}>
          HUDDLE<Text style={styles.logoPeriod}>.</Text>
        </Text>
        <View style={styles.seatedHeaderEnd}>
          {standing.youAreHost ? <HostPill /> : null}
          <StickerSurface depth={shadowDepth.phoneSmall} style={styles.codeChip}>
            <Text style={styles.codeChipText}>{code}</Text>
          </StickerSurface>
        </View>
      </View>

      {/* The avatar is the claimed color the moment it is claimed, and a plain
          Boardwalk face until then: a player lands on this screen before they
          have picked anything, so the circle has to be drawable without one.
          Both answers come from `playerFace`, which is what stops this circle
          and the same player's seat on the TV from disagreeing. */}
      <StickerSurface
        depth={shadowDepth.phoneHero}
        style={[styles.avatar, { backgroundColor: face.fill }]}
      >
        <Text style={[styles.avatarInitials, { color: face.monogram }]}>
          {playerInitials(nickname)}
        </Text>
      </StickerSurface>

      <Text style={styles.title}>You’re in, {nickname}!</Text>

      {/* Directly under the heading, where §5 draws it, and above the color
          picker rather than below it: a color is claimed once and the roster is
          re-read all through a lobby, so the section a Host keeps coming back
          to is the one that should not need scrolling to. What it costs is
          measured against the task in docs/implementation-plan.md. */}
      {standing.youAreHost && browsing !== undefined ? (
        <HostRoster
          roster={roster}
          // `startControl` is pure and is asked again by the control itself; the
          // alternative is threading one answer through two sections that need
          // different halves of it.
          canStart={startControl(roster, browsing.index).enabled}
        />
      ) : null}

      <ColorPicker roster={roster} session={session} />

      <StickerSurface
        depth={shadowDepth.phoneCard}
        style={styles.statusCard}
        wrapperStyle={styles.stretch}
      >
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>{lobbyStatusText(standing)}</Text>
      </StickerSurface>

      <LobbyGameControls
        browsing={browsing}
        roster={roster}
        youAreHost={standing.youAreHost}
        settingsChoice={settingsChoice}
        onChooseSetting={setSettingsChoice}
      />

      {/* Last on the screen, and the Host's alone: it is the one control here
          that cannot be undone, so it sits as far from "Start" as the lobby is
          long. */}
      {standing.youAreHost ? <EndRoomControl /> : null}
    </PhoneScreen>
  );
}

/**
 * The Host ends the party (the scope's "end the room").
 *
 * The room's counterpart to "Back to lobby": that one ends a game and leaves the
 * room standing, this ends the room itself — every seat deleted, every phone
 * back on the Join Screen, the Room Code returned to the pool. It is offered in
 * the lobby rather than mid-game because a Host who wants out of a game has the
 * other control, and the room outlives games by design.
 *
 * Behind the same confirm sheet the Manage Sheet uses, for the reason removal is:
 * this deletes seats, and it deletes all of them at once. The failure is shown
 * rather than swallowed — a Host who taps and sees nothing happen has no way to
 * make sense of it — though the ordinary success of this control is the screen
 * disappearing, since this phone's own seat goes with the room.
 */
function EndRoomControl() {
  const [confirming, setConfirming] = useState(false);

  return (
    <View style={styles.field}>
      <Pressable
        style={styles.stretch}
        onPress={() => setConfirming(true)}
        accessibilityRole="button"
      >
        {({ pressed }) => (
          <StickerSurface
            depth={shadowDepth.phoneCard}
            style={[styles.button, styles.endRoomButton, pressed && styles.buttonPressed]}
            wrapperStyle={styles.stretch}
          >
            <Text style={styles.buttonLabel}>{END_ROOM.label}</Text>
          </StickerSurface>
        )}
      </Pressable>

      {confirming ? <EndRoomSheet onDismiss={() => setConfirming(false)} /> : null}
    </View>
  );
}

/**
 * The shell both host-confirm sheets wear: a centred Boardwalk card floated over
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

        <StickerSurface
          depth={shadowDepth.phoneCard}
          style={styles.sheet}
          wrapperStyle={styles.sheetWrapper}
        >
          {children}

          <Pressable
            style={styles.sheetCancel}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.sheetCancelLabel}>Cancel</Text>
          </Pressable>
        </StickerSurface>
      </View>
    </Modal>
  );
}

/**
 * The confirm sheet for ending the room: what is lost, and the two ways out.
 *
 * The Manage Sheet's surface — a centred Boardwalk card over an ink scrim,
 * dismissed by the scrim or by Cancel — because this is the same kind of act it
 * confirms, one step further: it takes every seat rather than one.
 */
function EndRoomSheet({ onDismiss }: { readonly onDismiss: () => void }) {
  const endRoom = useMutation(api.rooms.endRoom);
  const [ending, setEnding] = useState(false);
  const [failure, setFailure] = useState<string>();

  async function confirm() {
    setEnding(true);
    setFailure(undefined);

    try {
      const sessionToken = await phoneSessionTokenStore.read();

      if (sessionToken === null) {
        setFailure(hostControlRejectionMessage({ kind: 'notInRoom' }));
        return;
      }

      await endRoom({ sessionToken });
      // Nothing to dismiss on success: this phone's seat went with the room, so
      // the seat subscription on the screen behind this sheet reads `null` and
      // takes the whole thing — this sheet included — back to the Join Screen.
      // Every other phone in the room gets there the same way, which is what
      // makes `END_ROOM.body` true rather than merely reassuring.
    } catch (error) {
      setFailure(hostControlFailureMessage(error));
    } finally {
      setEnding(false);
    }
  }

  return (
    <ConfirmSheet onDismiss={onDismiss}>
      <Text style={styles.sheetTitle}>{END_ROOM.title}</Text>
      <Text style={styles.sheetBody}>{END_ROOM.body}</Text>

      <Pressable
        style={styles.stretch}
        disabled={ending}
        onPress={() => void confirm()}
        accessibilityRole="button"
        accessibilityState={{ disabled: ending }}
      >
        {({ pressed }) => (
          <StickerSurface
            depth={shadowDepth.phoneSmall}
            style={[styles.button, styles.endRoomButton, pressed && styles.buttonPressed]}
            wrapperStyle={styles.stretch}
          >
            <Text style={styles.buttonLabel}>
              {ending ? END_ROOM.busyLabel : END_ROOM.confirmLabel}
            </Text>
          </StickerSurface>
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
 * What the lobby offers below the status card: the Host's picker (handoff §7),
 * and for everybody else the one thing they need to know about the room (§8).
 *
 * Both draw the card the room is browsing, which is why the screen above hands
 * it down rather than each section asking: "Now viewing Trivia" on a player's
 * phone is the card the Host is looking at and the card the television is
 * showing — one subscription, three screens, and §5's roster above makes a
 * fourth reader of it.
 */
function LobbyGameControls({
  browsing,
  roster,
  youAreHost,
  settingsChoice,
  onChooseSetting,
}: {
  /** The card the room is on; `undefined` only in a build with no games. */
  readonly browsing: CarouselWindow | undefined;
  readonly roster: readonly RosterSeat[];
  readonly youAreHost: boolean;
  /** The Host's settings, kept by the screen above — see `YoureInScreen`. */
  readonly settingsChoice: SettingsChoice | undefined;
  readonly onChooseSetting: (next: (current: SettingsChoice | undefined) => SettingsChoice) => void;
}) {
  if (browsing === undefined) {
    return null;
  }

  return youAreHost ? (
    <HostGamePicker
      browsing={browsing}
      roster={roster}
      settingsChoice={settingsChoice}
      onChooseSetting={onChooseSetting}
    />
  ) : (
    <NowViewing browsing={browsing} />
  );
}

/**
 * Phone — Host lobby (handoff §5): who is in the room, and whether the party
 * can begin.
 *
 * It is the Host's screen because §5 is, and because the Host is the one with
 * something to do about what it says: wait for the phone that has gone quiet,
 * or start without them. It is also the only place left in Huddle that says a
 * non-Host player is away between games — see `host-roster.ts`, which carries
 * the reasoning, and the departures recorded against §5 in
 * docs/implementation-plan.md.
 *
 * A section rather than the screen §5 draws. The Host already has §4's screen
 * (their avatar, "You're in, <Name>!", the color picker) and §7's picker, and
 * one screen cannot carry two headings — the same reason §8 is the tail of §4
 * here. So §5's "Your room" is a section label in the vocabulary the rest of
 * this screen labels its sections with.
 *
 * Where it sits is not cosmetic. §5 draws the rows immediately under the
 * heading and they are drawn there, above §4's color picker, because a section
 * the Host has to scroll to is a section a party does not read — and this one
 * carries news nothing else in the product carries. It does not fit every room:
 * from about the sixth player the last rows and the count line fall below the
 * fold on a 402×874 phone, which is measured against the task in
 * docs/implementation-plan.md rather than left to be discovered.
 */
function HostRoster({
  roster,
  canStart,
}: {
  readonly roster: readonly RosterSeat[];
  readonly canStart: boolean;
}) {
  // Which player's row the Host has opened to manage, if any. Held as the id
  // rather than the seat so the sheet always reads the *current* row off the
  // live roster: a target that goes away between opening the sheet and acting
  // dims transfer without the sheet reopening, and a target that leaves the room
  // (or is removed) drops out of `roster` and closes the sheet on its own.
  const [managing, setManaging] = useState<RosterSeat['playerId']>();
  const managingSeat = roster.find((seat) => seat.playerId === managing);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>YOUR ROOM</Text>

      <View style={styles.roster}>
        {roster.map((seat) => (
          <RosterRow key={seat.playerId} seat={seat} onManage={setManaging} />
        ))}
      </View>

      <Text style={styles.aside}>{rosterFooterLine(roster.length, canStart)}</Text>

      {managingSeat === undefined ? null : (
        <ManagePlayerSheet seat={managingSeat} onDismiss={() => setManaging(undefined)} />
      )}
    </View>
  );
}

/**
 * One player, as §5 draws a roster row: white, ink-bordered, on its own small
 * offset shadow — a 40px avatar, the nickname, and the right slot.
 *
 * The away treatment is the one the away-badge task settled on for a listed
 * player and the TV seats wore until the carousel took their screen: the face
 * dims to Boardwalk's "present but unavailable" opacity, the dot mutes, and the
 * nickname goes to muted text rather than dimming with the circle — 30% ink is
 * not text any more. The dot's colour is the only part of that a screen reader
 * cannot see, which is what `rosterRowSpokenAs` is for.
 *
 * Every row but the Host's own opens the manage sheet (task 3.7): the room is
 * the Host's to hand over or clear a seat from, and `rosterRowIsManageable` is
 * where "every row but the Host's own" is decided, so the row draws a
 * disclosure chevron and becomes a button exactly where a control is on offer.
 * The Host's own row stays a plain label — there is nothing to do to oneself
 * (`targetIsSelf`).
 */
function RosterRow({
  seat,
  onManage,
}: {
  readonly seat: RosterSeat;
  readonly onManage: (playerId: RosterSeat['playerId']) => void;
}) {
  const slot = rosterRowSlot(seat);
  const away = slot === 'away';
  const face = playerFace(seat.color);
  const manageable = rosterRowIsManageable(seat);

  const row = (
    <StickerSurface
      depth={shadowDepth.phoneSmall}
      style={styles.rosterRow}
      wrapperStyle={styles.stretch}
    >
      <View
        style={[styles.rosterAvatar, { backgroundColor: face.fill }, away && styles.rosterAway]}
      >
        <Text style={[styles.rosterInitials, { color: face.monogram }]}>
          {playerInitials(seat.nickname)}
        </Text>
      </View>

      <Text style={[styles.rosterName, away && styles.rosterNameAway]} numberOfLines={1}>
        {seat.nickname}
      </Text>

      {slot === 'host' ? (
        <HostPill />
      ) : (
        <View style={[styles.statusDot, away && styles.statusDotAway]} />
      )}

      {/* The disclosure chevron a mobile list wears to say a row opens onto
          more — drawn only where there is more, so the Host's own row does not
          invite a tap that has nothing behind it. */}
      {manageable ? <Text style={styles.rosterDisclosure}>›</Text> : null}
    </StickerSurface>
  );

  // The label and role are on the wrapper rather than the surface: `StickerSurface`
  // is a shadow and a face, and forwards no accessibility of its own. A
  // manageable row is a button that opens the sheet; the Host's own row is a
  // plain label with nothing to press.
  return manageable ? (
    <Pressable
      style={styles.stretch}
      onPress={() => onManage(seat.playerId)}
      accessibilityRole="button"
      accessibilityLabel={rosterRowSpokenAs(seat)}
      accessibilityHint="Opens options to make host or remove"
    >
      {row}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={rosterRowSpokenAs(seat)} style={styles.stretch}>
      {row}
    </View>
  );
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
  const face = playerFace(seat.color);
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
      <View style={styles.sheetHeader}>
        <View
          style={[styles.rosterAvatar, { backgroundColor: face.fill }, away && styles.rosterAway]}
        >
          <Text style={[styles.rosterInitials, { color: face.monogram }]}>
            {playerInitials(seat.nickname)}
          </Text>
        </View>
        <Text style={styles.sheetName} numberOfLines={1}>
          {seat.nickname}
        </Text>
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
 * One control in the manage sheet: a full-width Boardwalk button that runs a
 * host power, or sits dimmed with the line saying why it cannot.
 *
 * Remove wears Boardwalk's punch — the same "this ends something" face as Back
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
          <StickerSurface
            depth={shadowDepth.phoneCard}
            style={[styles.button, remove && styles.sheetRemove, pressed && styles.buttonPressed]}
            // Dimmed whenever it cannot be pressed — a disabled transfer (away
            // target), and either action while the other is in flight — so a
            // button that ignores a tap never looks fully live.
            wrapperStyle={[styles.stretch, !pressable && styles.buttonUnavailable]}
          >
            <Text style={styles.buttonLabel}>{busy ? 'Working…' : control.label}</Text>
          </StickerSurface>
        )}
      </Pressable>

      {control.disabledBecause === undefined ? null : (
        <Text style={styles.waitingFor}>{control.disabledBecause}</Text>
      )}
    </View>
  );
}

/**
 * Phone — Host game picker (handoff §7): the card being browsed, arrows either
 * side of "1 / 1", and the button that starts it.
 *
 * The arrows write `browsingGameIndex` and nothing else — the television is
 * following the room, not this phone, so what the Host sees here and what the
 * room sees on the TV cannot come apart.
 */
function HostGamePicker({
  browsing,
  roster,
  settingsChoice,
  onChooseSetting,
}: {
  readonly browsing: CarouselWindow;
  readonly roster: readonly RosterSeat[];
  readonly settingsChoice: SettingsChoice | undefined;
  readonly onChooseSetting: (next: (current: SettingsChoice | undefined) => SettingsChoice) => void;
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
    <View style={styles.field}>
      <Text style={styles.label}>YOU’RE THE HOST — PICK A GAME</Text>

      <View style={styles.pickerRow}>
        <RoundButton label="‹" enabled={back !== undefined} onPress={() => void browse(back)} />
        <View style={styles.pickedGame}>
          <Text style={styles.pickedTitle}>{browsing.focused.metadata.title}</Text>
          <Text style={styles.pickedMeta}>{browsedGameMeta(browsing.focused.metadata)}</Text>
          <Text style={styles.pickedPosition}>
            {browsing.index + 1} / {browsing.total}
          </Text>
        </View>
        <RoundButton label="›" enabled={on !== undefined} onPress={() => void browse(on)} />
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
 * One value of one setting, as Boardwalk draws a choice: the chosen chip is
 * cobalt and sits on its own shadow, the rest are white and flat.
 *
 * The same treatment the color picker gives a claimed swatch, for the same
 * reason — the sticker shadow is what Boardwalk uses to lift the thing that is
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
          <StickerSurface
            depth={shadowDepth.phoneSmall}
            style={[
              styles.settingOption,
              styles.settingOptionChosen,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={[styles.settingOptionLabel, styles.settingOptionLabelChosen]}>
              {label}
            </Text>
          </StickerSurface>
        ) : (
          // No press travel on the flat chip, as with an unclaimed swatch:
          // Boardwalk's press is a sticker going down onto its own shadow, and
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
 * Phone — Player waiting (handoff §8): the card the room is looking at, on the
 * status card the handoff draws it on, and the line saying what this phone is
 * about to become.
 *
 * It is the same Boardwalk surface as the lobby's own status card above it —
 * white, green dot, one line — because it is the same kind of statement: the
 * room is doing something and this phone is watching. The handoff draws §8 as a
 * screen of its own; here it is the tail of §4, for the reason the Host's
 * picker is (see `LobbyGameControls`).
 */
function NowViewing({ browsing }: { readonly browsing: CarouselWindow }) {
  return (
    <View style={styles.field}>
      <StickerSurface
        depth={shadowDepth.phoneCard}
        style={styles.statusCard}
        wrapperStyle={styles.stretch}
      >
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>{nowViewingLine(browsing.focused.metadata)}</Text>
      </StickerSurface>
      <Text style={[styles.aside, styles.asideCentred]}>{NOW_VIEWING_CAPTION}</Text>
    </View>
  );
}

/** One of the picker's 76px round buttons (§7). */
function RoundButton({
  label,
  enabled,
  onPress,
}: {
  readonly label: string;
  readonly enabled: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      disabled={!enabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
    >
      {({ pressed }) => (
        <StickerSurface
          depth={shadowDepth.phoneSmall}
          style={[styles.roundButton, pressed && styles.buttonPressed]}
          wrapperStyle={enabled ? undefined : styles.buttonUnavailable}
        >
          <Text style={styles.roundButtonLabel}>{label}</Text>
        </StickerSurface>
      )}
    </Pressable>
  );
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
          <StickerSurface
            depth={shadowDepth.phoneCard}
            style={[styles.button, pressed && styles.buttonPressed]}
            wrapperStyle={[styles.stretch, !control.enabled && styles.buttonUnavailable]}
          >
            <Text style={styles.buttonLabel}>
              {starting ? 'Starting…' : control.label}
            </Text>
          </StickerSurface>
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
        <Text style={styles.logoSmall}>
          HUDDLE<Text style={styles.logoPeriod}>.</Text>
        </Text>
        <View style={styles.seatedHeaderEnd}>
          {youAreHost ? <HostPill /> : null}
          <StickerSurface depth={shadowDepth.phoneSmall} style={styles.codeChip}>
            <Text style={styles.codeChipText}>{code}</Text>
          </StickerSurface>
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
          <StickerSurface
            depth={shadowDepth.phoneCard}
            style={[styles.button, styles.backToLobbyButton, pressed && styles.buttonPressed]}
            wrapperStyle={styles.stretch}
          >
            <Text style={styles.buttonLabel}>{backToLobbyLabel(returning)}</Text>
          </StickerSurface>
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
 * The room is playing a game this build does not have.
 *
 * An un-updated phone in a room whose TV has been updated. It is not the lobby,
 * because a lobby would invite a player to act on a room that is mid-game.
 *
 * The Host gets their way back here too. Everybody else on this screen is
 * waiting for the room to return to its lobby, and if the phone that runs the
 * room is the one that is behind, then without this it is waiting on itself —
 * a room that nothing in it can move.
 */
function UnknownGameScreen({
  code,
  gameId,
  youAreHost,
}: {
  readonly code: string;
  readonly gameId: string;
  readonly youAreHost: boolean;
}) {
  // The news itself is the same for everybody in the room; only what there is to
  // do about it differs, so the two lines are one sentence and a tail rather
  // than two sentences to keep in step.
  const behind = `This room is playing ${gameId}, which this phone doesn’t have yet.`;
  const whatToDo = youAreHost
    ? 'It is still your room, though — take everyone back to the lobby, or update Huddle to play along.'
    : 'Watch the TV — you’ll rejoin when they’re back in the lobby.';

  return (
    <PhoneScreen>
      <View style={styles.seatedHeader}>
        <Text style={styles.logoSmall}>
          HUDDLE<Text style={styles.logoPeriod}>.</Text>
        </Text>
        <View style={styles.seatedHeaderEnd}>
          {youAreHost ? <HostPill /> : null}
          <StickerSurface depth={shadowDepth.phoneSmall} style={styles.codeChip}>
            <Text style={styles.codeChipText}>{code}</Text>
          </StickerSurface>
        </View>
      </View>

      <Text style={styles.title}>Update Huddle</Text>

      <StickerSurface
        depth={shadowDepth.phoneCard}
        style={styles.statusCard}
        wrapperStyle={styles.stretch}
      >
        <Text style={styles.statusText}>
          {behind} {whatToDo}
        </Text>
      </StickerSurface>

      {youAreHost ? <BackToLobbyControl /> : null}
    </PhoneScreen>
  );
}

/**
 * YOUR COLOR (handoff §4): the ten swatches, and the tap that claims one.
 *
 * What is dimmed is read from the roster rather than remembered, so the picker
 * shows what the room says right now — a swatch claimed across the room goes
 * unavailable here without this phone touching anything. The claim is still
 * refused server-side when two thumbs land inside a round trip of each other,
 * which is the one refusal a player can actually meet, and it is said out loud
 * rather than swallowed.
 */
function ColorPicker({
  roster,
  session,
}: {
  readonly roster: readonly RosterSeat[];
  readonly session: PlayerSession;
}) {
  const claimColor = useMutation(api.players.claimColor);
  const [failure, setFailure] = useState<string>();
  const swatches = pickerSwatches(roster, session.playerId);

  // Whether the player has tapped a swatch themselves. It exists only to stand
  // down the auto-claim below: a returning player who taps a *different* color
  // in the first moment on screen has just said what they want, and the color
  // this phone happened to remember must not race in behind that tap and win.
  const userClaimed = useRef(false);

  async function claim(color: PlayerColorName) {
    userClaimed.current = true;
    // The last refusal stops being true the moment another swatch is tried.
    setFailure(undefined);

    try {
      // Read from the keystore rather than held in this screen's state, as the
      // heartbeat does: the token identifies the player and nothing that
      // renders needs it.
      const sessionToken = await phoneSessionTokenStore.read();

      if (sessionToken === null) {
        // A phone that cannot say who it is cannot claim anything, and the
        // server's own word for that is the one to show.
        setFailure(rejectionMessage({ kind: 'notInRoom' }));
        return;
      }

      await claimColor({ sessionToken, color });
      // The color that just stuck, so the next room this phone joins opens on it.
      void rememberColor(phoneIdentityStore, color);
    } catch (error) {
      setFailure(claimFailureMessage(error));
    }
  }

  // The avatar half of "remember me": a returning player's last color, re-taken
  // on their behalf the first time they sit down colorless in a room, so the
  // swatch they know is already theirs.
  //
  // It fires at most once per mount (`autoClaimTried`), and only once the roster
  // has actually landed — an empty roster is the subscription still in flight,
  // since this player's own seat is always in it once it does, so acting on `[]`
  // would mean claiming before the room could say this seat already holds a
  // color. A seat that already has one (a rejoin) is left alone. Unlike a tapped
  // claim it is silent: a refusal is nobody's mistake to be shown — the swatch
  // was taken across the room a moment earlier — so it is swallowed, and the
  // player picks from what the swatches now offer.
  const autoClaimTried = useRef(false);
  useEffect(() => {
    if (autoClaimTried.current || roster.length === 0) {
      return;
    }
    autoClaimTried.current = true;

    if (yourColor(roster, session.playerId) !== undefined) {
      return;
    }

    void (async () => {
      const wanted = (await recallIdentity(phoneIdentityStore)).color;
      if (wanted === null) {
        return;
      }
      // Only if it is still free — the picker's own answer — so the common case
      // costs no refusal and no flicker of a failure the player never caused.
      const swatch = pickerSwatches(roster, session.playerId).find((s) => s.name === wanted);
      if (swatch?.state !== 'free') {
        return;
      }

      const sessionToken = await phoneSessionTokenStore.read();
      if (sessionToken === null) {
        return;
      }
      // Checked last, after every await: if the player tapped a swatch while
      // this was reading storage and the keystore, that tap is the answer and
      // this one stands down rather than landing on top of it.
      if (userClaimed.current) {
        return;
      }
      try {
        await claimColor({ sessionToken, color: wanted });
        void rememberColor(phoneIdentityStore, wanted);
      } catch {
        // Swallowed on purpose: this claim was the phone's idea, not the
        // player's.
      }
    })();
  }, [roster, session.playerId, claimColor]);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>YOUR COLOR</Text>
      <View style={styles.swatches}>
        {swatches.map(({ name, state }) => (
          <Swatch key={name} name={name} state={state} onPress={() => void claim(name)} />
        ))}
      </View>

      {failure === undefined ? null : (
        <Text style={styles.failure} accessibilityLiveRegion="polite">
          {failure}
        </Text>
      )}
    </View>
  );
}

/**
 * One swatch: a 44px circle of the color, per the handoff — the player's own
 * carrying Boardwalk's ink border and shadow, and one somebody else holds
 * dimmed to the opacity Boardwalk dims anything unavailable to.
 *
 * A taken swatch is not pressable, which is the courtesy; `claimColor` is what
 * makes it a rule.
 */
function Swatch({
  name,
  state,
  onPress,
}: {
  readonly name: PlayerColorName;
  readonly state: SwatchState;
  readonly onPress: () => void;
}) {
  const color: PlayerColor = playerColor(name);
  const taken = state === 'taken';

  // No press state: the swatches carry Boardwalk's only "dimmed" treatment to
  // mean *somebody else holds this*, so dipping a free one under a thumb would
  // say the opposite of what is happening. The feedback is the claim itself —
  // the swatch gains the ink border and the shadow the moment it is the
  // player's, which is a round trip away.
  return (
    <Pressable
      disabled={taken}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name} color`}
      accessibilityState={{ disabled: taken, selected: state === 'yours' }}
    >
      {state === 'yours' ? (
        <StickerSurface
          depth={shadowDepth.phoneSmall}
          style={[styles.swatch, styles.swatchYours, { backgroundColor: color.fill }]}
        />
      ) : (
        <View style={[styles.swatch, { backgroundColor: color.fill }, taken && styles.swatchTaken]} />
      )}
    </Pressable>
  );
}

/** Boardwalk's HOST pill (handoff §5): ink fill, white Bungee, fully rounded. */
function HostPill() {
  return (
    <View style={styles.hostPill}>
      <Text style={styles.hostPillText}>HOST</Text>
    </View>
  );
}

/**
 * Who else is in the room, live.
 *
 * The seated screen subscribes to the same roster the TV draws its seats from,
 * because everything on it that can change without this phone doing anything is
 * on that one query: who is running the room, and which colors are spoken for.
 * So a handover and a swatch claimed across the room both arrive as a push,
 * within a round trip of the room deciding them, rather than at the next launch.
 *
 * An empty roster while the subscription is in flight is the right neutral: no
 * host to name yet, and no color yet claimed by anybody.
 */
function useRoomRoster(session: PlayerSession): readonly RosterSeat[] {
  return useQuery(api.players.roster, { roomId: session.roomId }) ?? [];
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

// Every measurement below is the handoff's own for phone screens (§2, §4).
const styles = StyleSheet.create({
  heading: {
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    color: colors.ink,
    fontFamily: fontFamily.display,
    fontSize: 20,
  },
  logoSmall: {
    color: colors.ink,
    fontFamily: fontFamily.display,
    fontSize: 16,
  },
  logoPeriod: {
    color: colors.tangerine,
  },
  title: {
    color: colors.ink,
    fontFamily: fontFamily.display,
    fontSize: 28,
    // Bungee's line box runs taller than its caps; pinning it keeps the
    // heading's own spacing rather than the font's.
    lineHeight: 34,
    textAlign: 'center',
  },

  field: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 10,
  },
  // A measurement the handoff gives and this screen does not take.
  // §2 writes this label at 13px, and the same document floors phone body text
  // at 14 — and this is body text by that document's own naming, since its two
  // type roles are Display (Bungee) and Body/UI (Space Grotesk 400–700) and
  // this is the second one. A floor a single spec line can undercut is not a
  // floor, so the floor wins and the 1px is spent. Written as the token rather
  // than as `14` for exactly that reason: this element's handoff measurement is
  // 13, so a bare 14 would read as one and hide which of the document's two
  // lines won. The token says it, and moves if Boardwalk ever moves the floor.
  label: {
    alignSelf: 'flex-start',
    color: colors.mutedText,
    fontFamily: fontFamily.bodyBold,
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
    borderWidth: borderWidth.medium,
    // Proportional to the TV tile's 24px on 148px, so the phone's smaller tile
    // reads as the same object (handoff: 10–16px on small elements).
    borderRadius: radius.chip,
  },
  tileActive: {
    borderColor: colors.cobalt,
  },
  tileEmpty: {
    borderColor: colors.mutedBorder,
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
    fontFamily: fontFamily.display,
    fontSize: 36,
    // As on the TV's tiles: Bungee rides low in its own line box unless the
    // line is pinned to the cap height.
    lineHeight: 40,
  },
  caret: {
    width: 3,
    height: 36,
    backgroundColor: colors.cobalt,
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

  // A StickerSurface wrapper sits between a full-width surface and its parent,
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
    borderWidth: borderWidth.medium,
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
    fontFamily: fontFamily.bodyMedium,
    fontSize: 18,
  },

  button: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    minHeight: 56,
    backgroundColor: colors.cobalt,
    borderColor: colors.ink,
    borderWidth: borderWidth.medium,
    borderRadius: radius.button,
  },
  buttonUnavailable: {
    opacity: opacity.unavailable,
  },
  // Boardwalk's press: the button travels into its own shadow. The shadow is a
  // rectangle sitting still behind it, so moving the face is the whole effect —
  // what shows past the edge shortens by exactly as far as the button went, and
  // no second shadow value has to be kept in step with this one.
  buttonPressed: {
    transform: [{ translateX: PRESS_TRAVEL }, { translateY: PRESS_TRAVEL }],
  },
  buttonLabel: {
    color: colors.surface,
    fontFamily: fontFamily.bodyBold,
    fontSize: 18,
  },
  failure: {
    alignSelf: 'stretch',
    color: colors.punch,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 15,
    lineHeight: 20,
  },

  // The seat-loss notice under the heading. Ink rather than punch: a removed or
  // closed-out player is being told what happened, not warned off a mistake, so
  // it reads as the form's own line and not as the red a rejection wears.
  notice: {
    alignSelf: 'stretch',
    color: colors.ink,
    fontFamily: fontFamily.bodyMedium,
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
  hostPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
  },
  hostPillText: {
    color: colors.surface,
    fontFamily: fontFamily.display,
    // The smallest type on the phone, so the pill reads as the code chip's
    // sibling rather than shouting over it. This 13 was the field label's 13
    // until the Body Text Floor took that one to 14; the handoff sizes this
    // pill nowhere, so it now stands on its own rather than on a match. Outside
    // the floor either way, because Bungee is Boardwalk's display face — and
    // that exemption is not a claim anybody can make on a line: it costs an
    // actual change of face, and Bungee's caps at 13 stand taller and heavier
    // than Space Grotesk's do.
    fontSize: 13,
    letterSpacing: letterSpacing.label,
    // The label's letter spacing trails its last letter; pulling it back keeps
    // the word centred in the pill.
    marginRight: -letterSpacing.label,
  },
  codeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.medium,
    borderRadius: radius.chip,
  },
  codeChipText: {
    color: colors.cobalt,
    fontFamily: fontFamily.display,
    fontSize: 20,
    letterSpacing: letterSpacing.roomCode,
    // The room-code chip's letter spacing trails the last letter too; pulling
    // it back keeps the text optically centred in the chip.
    marginRight: -letterSpacing.roomCode,
  },

  // The fill and the monogram's ink both arrive from `playerFace`, so neither
  // is stated here: a default would only ever be the answer it already gives
  // for a player who has claimed nothing.
  avatar: {
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.ink,
    borderWidth: borderWidth.thick,
    borderRadius: radius.pill,
  },
  avatarInitials: {
    fontFamily: fontFamily.display,
    // The TV's seat draws a 24px monogram in a 72px circle; this circle is
    // 128px, and the monogram keeps its proportion.
    fontSize: 42,
    lineHeight: 46,
  },

  // Ten 44px circles (the handoff's size), wrapped: a row of ten runs 500px
  // before any gap, on a phone that is 390–430 wide. How many land on the first
  // row is the phone's business and not a number written down here — an iPhone
  // 17 takes six, a 390pt phone five — which is why they are centred rather
  // than laid out in a grid a narrower screen would break.
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'stretch',
    justifyContent: 'center',
    gap: 12,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
  },
  // The handoff gives the selected swatch the ink border and the shadow; the
  // shadow comes from the StickerSurface this is drawn on.
  swatchYours: {
    borderColor: colors.ink,
    borderWidth: borderWidth.medium,
  },
  // Boardwalk's treatment for something present but not available — the same
  // 30% the TV dims an away player's face to.
  swatchTaken: {
    opacity: opacity.unavailable,
  },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.medium,
    borderRadius: radius.row,
  },
  // The Host's roster (§5). The rows sit closer together than the screen's own
  // 28pt section gap: they are one list, not four sections.
  roster: {
    alignSelf: 'stretch',
    gap: 10,
  },
  // §5's row, measurement for measurement: white, 3px ink border, radius 16,
  // and the 3px shadow its `StickerSurface` casts.
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.medium,
    borderRadius: radius.input,
  },
  // §5's 40px avatar. Its ink is Boardwalk's thin border rather than the row's
  // own 3px: a circle inside a bordered row drawn at the row's width would
  // out-weigh the thing containing it, and 2px on 40px is the proportion the
  // handoff's 4px on §4's 128px circle already sets.
  rosterAvatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.ink,
    borderWidth: borderWidth.thin,
    borderRadius: radius.pill,
  },
  rosterInitials: {
    fontFamily: fontFamily.display,
    // The proportion the TV's seat and §4's hero avatar both keep — a monogram
    // about a third of the circle it sits in.
    fontSize: 14,
    // Bungee rides low in its own line box; pinning it centres the monogram.
    lineHeight: 16,
  },
  // Boardwalk's treatment for something present but not available, which is
  // exactly what an away player is. The circle only: see `rosterNameAway`.
  rosterAway: {
    opacity: opacity.unavailable,
  },
  rosterName: {
    flex: 1,
    color: colors.ink,
    fontFamily: fontFamily.bodyBold,
    fontSize: 16,
  },
  // The nickname mutes rather than dimming with the circle — ink at 30% stops
  // being text, which is the away-badge task's own measurement.
  rosterNameAway: {
    color: colors.mutedText,
  },
  // The muted half of the Status Dot: the room is not hearing
  // from this phone.
  statusDotAway: {
    backgroundColor: colors.mutedBorder,
  },
  // The disclosure chevron on a manageable row — Boardwalk's own glyph (§7's
  // picker draws the same one), muted so it reads as an affordance the row
  // carries rather than a control competing with the name.
  rosterDisclosure: {
    color: colors.mutedText,
    fontFamily: fontFamily.display,
    fontSize: 22,
    // Bungee rides low in its own line box; pinning it centres the chevron on
    // the row.
    lineHeight: 24,
  },

  // The manage sheet (task 3.7): a centred confirm dialog over a dimmed room.
  // Centred rather than a bottom sheet so it clears the home indicator without
  // this screen reaching for the safe area the Modal renders outside of.
  sheetRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  // Boardwalk's scrim: ink pulled back to a wash, so the room reads as still
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
    borderWidth: borderWidth.medium,
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
    fontFamily: fontFamily.bodyBold,
    fontSize: 20,
  },
  // Boardwalk's "this ends something" face, the same punch as Back to lobby:
  // removing a player deletes their seat and is not undone.
  sheetRemove: {
    backgroundColor: colors.punch,
  },
  // The end-room sheet's own title: `sheetName` is a row item beside an avatar
  // and stretches to fill it, which is not what a heading on its own line does.
  sheetTitle: {
    alignSelf: 'stretch',
    color: colors.ink,
    fontFamily: fontFamily.bodyBold,
    fontSize: 20,
  },
  // What ending the room costs, said before it is done. Body text, so it is read
  // at the phone floor rather than at the heading's size.
  sheetBody: {
    alignSelf: 'stretch',
    color: colors.mutedText,
    fontFamily: fontFamily.bodyMedium,
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
    fontFamily: fontFamily.bodyBold,
    fontSize: 16,
  },
  // Boardwalk's aside on a phone screen: something true about the room rather
  // than something to press — §5's count line, §7's swipe hint, §8's caption.
  // One entry rather than three near-copies, each of whose comment claimed to
  // be a copy of one of the others.
  aside: {
    alignSelf: 'stretch',
    color: colors.mutedText,
    fontFamily: fontFamily.bodyMedium,
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
  // The handoff's 76px round buttons, in Boardwalk's white-and-ink.
  roundButton: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.medium,
    borderRadius: radius.pill,
  },
  roundButtonLabel: {
    color: colors.ink,
    fontFamily: fontFamily.display,
    fontSize: 30,
    // Bungee rides low in its own line box; pinning it centres the chevron.
    lineHeight: 34,
  },
  pickedGame: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  pickedTitle: {
    color: colors.ink,
    fontFamily: fontFamily.display,
    fontSize: 22,
    lineHeight: 26,
    textAlign: 'center',
  },
  // The handoff's "title + meta" on the selected-game card (§7): the same three
  // facts the TV's carousel chips carry, on one line because a phone's card is
  // as wide as a thumb and three chips would wrap into a paragraph.
  pickedMeta: {
    color: colors.mutedText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 15,
    textAlign: 'center',
  },
  // Where in the list the card is — the handoff puts this between the arrows
  // ("Prev/next round buttons 76px … with '2 / 3' between") but pins no weight
  // for it, so it keeps the one it has always had rather than gaining emphasis
  // this pass has no line to trace.
  pickedPosition: {
    color: colors.mutedText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 15,
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
    fontFamily: fontFamily.bodyBold,
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
    // Thin, as Boardwalk borders a chip — these sit inside the picker's own
    // 3px surfaces and would out-weigh them at the same width.
    borderWidth: borderWidth.thin,
    borderRadius: radius.chip,
  },
  settingOptionChosen: {
    backgroundColor: colors.cobalt,
  },
  settingOptionLabel: {
    color: colors.ink,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 15,
  },
  settingOptionLabelChosen: {
    color: colors.surface,
    fontFamily: fontFamily.bodyBold,
  },

  // Boardwalk's "this ends something" surface, and the only punch button on a
  // phone screen — it is meant to be found, not stumbled into.
  backToLobbyButton: {
    backgroundColor: colors.punch,
  },
  // The same punch every irreversible control in Huddle wears (see
  // `sheetRemove`): ending the room deletes every seat in it.
  endRoomButton: {
    backgroundColor: colors.punch,
  },
  waitingFor: {
    alignSelf: 'stretch',
    color: colors.mutedText,
    fontFamily: fontFamily.bodyMedium,
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
    backgroundColor: colors.green,
    borderRadius: radius.pill,
  },
  statusText: {
    flex: 1,
    color: colors.ink,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 16,
    lineHeight: 22,
  },
});
