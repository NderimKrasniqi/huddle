import { api } from '@huddle/convex';
import {
  gamePlayersFrom,
  type GameEvent,
  type GameModule,
  type GamePlayer,
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
  codeLetterColor,
  colors,
  fontFamily,
  letterSpacing,
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
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  activeCodeCell,
  canJoin,
  codeEntry,
  isCodeComplete,
  nicknameEntry,
} from '../src/join-entry';
import { pickerSwatches, type SwatchState, yourColor } from '../src/color-picker';
import { claimFailureMessage, rejectionMessage } from '../src/color-rejection';
import { gameToStart, startControl } from '../src/game-controls';
import { startFailureMessage } from '../src/game-rejection';
import { lobbyStanding, lobbyStatusText, type RosterSeat } from '../src/host';
import { joinFailureMessage } from '../src/join-rejection';
import { PhoneScreen } from '../src/phone-screen';
import { type ForegroundWatch, keepPresent } from '../src/presence';
import {
  joinScreenState,
  type PlayerSession,
  rememberSession,
  resumeSession,
} from '../src/session';
import { phoneSessionTokenStore } from '../src/session-store';

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
    return <YoureInScreen session={state.session} />;
  }

  // Keyed by the link so a second Join Link scanned while this screen is
  // already open starts the form over on the room it names, rather than leaving
  // the first room's code in tiles the player thinks they just replaced — which
  // covers the phone that already holds a seat and has just scanned another
  // room's TV, since `joinScreenState` sends that scan here. A typed join has
  // no link and so a constant key: nothing remounts under somebody's thumbs.
  return <JoinForm key={linkedCode ?? ''} linkedCode={linkedCode ?? ''} onSeated={setSession} />;
}

function JoinForm({
  linkedCode,
  onSeated,
}: {
  readonly linkedCode: string;
  readonly onSeated: (session: PlayerSession) => void;
}) {
  const prefilledCode = codeEntry(linkedCode);

  const [code, setCode] = useState(prefilledCode);
  const [nickname, setNickname] = useState('');
  const [joining, setJoining] = useState(false);
  const [failure, setFailure] = useState<string>();

  const nameField = useRef<TextInput>(null);
  const joinRoom = useMutation(api.players.joinRoom);

  // A rejection is about what the fields held when Join was tapped, so it stops
  // being true the moment either field changes: "Ada is already in that room"
  // must not still be on screen while its owner types a different name.
  function enterCode(typed: string) {
    const entered = codeEntry(typed);
    setCode(entered);
    setFailure(undefined);
    // The last letter advances the way every letter before it did — off the
    // tiles and into the only field left to fill.
    if (isCodeComplete(entered) && !isCodeComplete(code)) {
      nameField.current?.focus();
    }
  }

  function enterNickname(typed: string) {
    setNickname(nicknameEntry(typed));
    setFailure(undefined);
  }

  async function join() {
    const claimed = nickname.trim();
    setJoining(true);
    setFailure(undefined);

    try {
      // The token goes to the phone's storage and the seat goes to the screen:
      // it is what this player is identified by from now on, and nothing that
      // renders needs to hold it. The nickname shown is the room's, not the one
      // typed — the same value a rejoin would come back with.
      const { sessionToken, ...seat } = await joinRoom({ code, nickname: claimed });
      await rememberSession(phoneSessionTokenStore, sessionToken);
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

      <TextInput
        style={styles.codeInput}
        value={code}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect={false}
        spellCheck={false}
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
 * The Host gets the pill and a line saying the room is theirs, and nothing to
 * press: the handoff's host screen (§5) is a roster with a "Choose a game"
 * button, and both the roster and every control on it belong to the game
 * lifecycle in Phase 3. Until then this screen is where a player finds out they
 * are running the room — including when they become the host mid-party, which
 * is why the standing is read from a live query rather than from the answer
 * that seated them.
 */
function YoureInScreen({ session }: { readonly session: PlayerSession }) {
  const { code, nickname } = session;
  useHeartbeat();
  const roster = useRoomRoster(session);
  const standing = lobbyStanding(roster, session.playerId);
  const claimed = yourColor(roster, session.playerId);
  const face = playerFace(claimed);

  // The room's own word on what it is playing. A separate subscription from the
  // roster because the two change on entirely different beats — this twice a
  // game, the roster on every join, claim and heartbeat.
  const running = useQuery(api.games.running, { roomId: session.roomId });
  const screen = runningGameScreen(running);

  if (screen.kind === 'unknownGame') {
    return <UnknownGameScreen code={code} gameId={screen.gameId} />;
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
        roomId={session.roomId}
        roster={roster}
        youAreHost={standing.youAreHost}
      />
    </PhoneScreen>
  );
}

/**
 * What the lobby offers below the status card: the picker for the Host, and for
 * everybody else the one thing they need to know about it.
 *
 * Both read the same `browsingGameIndex`, so "Now viewing Trivia" on a player's
 * phone is the card the Host is looking at and the card the television is
 * showing — one subscription, three screens.
 */
function LobbyGameControls({
  roomId,
  roster,
  youAreHost,
}: {
  readonly roomId: PlayerSession['roomId'];
  readonly roster: readonly RosterSeat[];
  readonly youAreHost: boolean;
}) {
  const browsingAt = useQuery(api.games.browsing, { roomId });
  const browsing = carouselWindow(browsingAt ?? 0);

  if (browsing === undefined) {
    return null;
  }

  return youAreHost ? (
    <HostGamePicker browsing={browsing} roster={roster} />
  ) : (
    <NowViewing browsing={browsing} />
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
}: {
  readonly browsing: CarouselWindow;
  readonly roster: readonly RosterSeat[];
}) {
  const browseGame = useMutation(api.games.browseGame);
  const back = previousIndex(browsing.index);
  const on = nextIndex(browsing.index);

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
          <Text style={styles.pickedMeta}>
            {browsing.index + 1} / {browsing.total}
          </Text>
        </View>
        <RoundButton label="›" enabled={on !== undefined} onPress={() => void browse(on)} />
      </View>

      <Text style={styles.pickerHint}>Swipe or tap arrows — the TV follows along</Text>

      <StartGameControl roster={roster} browsingAt={browsing.index} />
    </View>
  );
}

/** Phone — Player waiting (handoff §8): the card the room is looking at. */
function NowViewing({ browsing }: { readonly browsing: CarouselWindow }) {
  return (
    <View style={styles.field}>
      <Text style={styles.nowViewing}>Now viewing {browsing.focused.metadata.title}</Text>
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
}: {
  readonly roster: readonly RosterSeat[];
  readonly browsingAt: number;
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
        await startGame({ sessionToken, gameId: game.id });
      }
    } catch (error) {
      setFailure(startFailureMessage(error));
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
            style={[styles.button, styles.startButton, pressed && styles.buttonPressed]}
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
 * is drawing. The module's screen draws nothing yet; the phone's four answer
 * buttons are their own task later in this phase.
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

      {youAreHost ? <EndGameControl /> : null}
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

  return (
    <View style={styles.gameStage}>
      {module.screens.controller({ state, player, sendEvent: send })}
    </View>
  );
}

/** The Host's way back to the lobby, with the room and its roster intact. */
function EndGameControl() {
  const endGame = useMutation(api.games.endGame);
  const [ending, setEnding] = useState(false);
  const [failure, setFailure] = useState<string>();

  async function end() {
    setEnding(true);
    setFailure(undefined);

    try {
      const sessionToken = await phoneSessionTokenStore.read();

      if (sessionToken === null) {
        setFailure('This phone has lost its seat — reopen the app to rejoin.');
        return;
      }

      await endGame({ sessionToken });
    } catch (error) {
      setFailure(startFailureMessage(error));
    } finally {
      setEnding(false);
    }
  }

  return (
    <View style={styles.field}>
      <Pressable
        style={styles.stretch}
        disabled={ending}
        onPress={() => void end()}
        accessibilityRole="button"
        accessibilityState={{ disabled: ending }}
      >
        {({ pressed }) => (
          <StickerSurface
            depth={shadowDepth.phoneCard}
            style={[styles.button, styles.endButton, pressed && styles.buttonPressed]}
            wrapperStyle={styles.stretch}
          >
            <Text style={styles.buttonLabel}>{ending ? 'Ending…' : 'End game'}</Text>
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
 */
function UnknownGameScreen({
  code,
  gameId,
}: {
  readonly code: string;
  readonly gameId: string;
}) {
  return (
    <PhoneScreen>
      <View style={styles.seatedHeader}>
        <Text style={styles.logoSmall}>
          HUDDLE<Text style={styles.logoPeriod}>.</Text>
        </Text>
        <StickerSurface depth={shadowDepth.phoneSmall} style={styles.codeChip}>
          <Text style={styles.codeChipText}>{code}</Text>
        </StickerSurface>
      </View>

      <Text style={styles.title}>Update Huddle</Text>

      <StickerSurface
        depth={shadowDepth.phoneCard}
        style={styles.statusCard}
        wrapperStyle={styles.stretch}
      >
        <Text style={styles.statusText}>
          This room is playing {gameId}, which this phone doesn’t have yet. Watch the TV — you’ll
          rejoin when they’re back in the lobby.
        </Text>
      </StickerSurface>
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

  async function claim(color: PlayerColorName) {
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
    } catch (error) {
      setFailure(claimFailureMessage(error));
    }
  }

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
  label: {
    alignSelf: 'flex-start',
    color: colors.mutedText,
    fontFamily: fontFamily.bodyBold,
    fontSize: 13,
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
    // The size this screen already sets its uppercase labels at, so the pill
    // reads as the code chip's sibling rather than shouting over it.
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

  // Ten 44px circles (the handoff's size) wrapped into two rows of five: a row
  // of ten would run 500px wide before any gap, on a screen that is 390.
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
  pickedMeta: {
    color: colors.mutedText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 15,
  },
  pickerHint: {
    alignSelf: 'stretch',
    color: colors.mutedText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 15,
    textAlign: 'center',
  },
  // What a player who is not running the room is told about the carousel: the
  // card the Host is on, which is the card on the television.
  nowViewing: {
    color: colors.ink,
    fontFamily: fontFamily.bodyBold,
    fontSize: 16,
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: colors.green,
  },
  // Boardwalk's "this ends something" surface, and the only punch button on a
  // phone screen — it is meant to be found, not stumbled into.
  endButton: {
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
