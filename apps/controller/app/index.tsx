import { api } from '@huddle/convex';
import { ROOM_CODE_LENGTH } from '@huddle/game-core';
import {
  borderWidth,
  codeLetterColor,
  colors,
  fontFamily,
  letterSpacing,
  opacity,
  playerInitials,
  radius,
  shadowDepth,
} from '@huddle/ui';
import { StickerSurface } from '@huddle/ui/native';
import { useConvex, useMutation } from 'convex/react';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  activeCodeCell,
  canJoin,
  codeEntry,
  isCodeComplete,
  nicknameEntry,
} from '../src/join-entry';
import { joinFailureMessage } from '../src/join-rejection';
import { PhoneScreen } from '../src/phone-screen';
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
 * The handoff puts a color picker on this screen. Color Claim is a Phase 2 task
 * and the server has nothing to claim a color with yet, so the picker is left
 * out and the avatar is a plain Boardwalk face — the same circle the TV draws
 * on its seats until a color is claimed.
 */
function YoureInScreen({ session }: { readonly session: PlayerSession }) {
  const { code, nickname } = session;

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

      <StickerSurface depth={shadowDepth.phoneHero} style={styles.avatar}>
        <Text style={styles.avatarInitials}>{playerInitials(nickname)}</Text>
      </StickerSurface>

      <Text style={styles.title}>You’re in, {nickname}!</Text>

      <StickerSurface
        depth={shadowDepth.phoneCard}
        style={styles.statusCard}
        wrapperStyle={styles.stretch}
      >
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>Eyes on the TV — your name is up there now.</Text>
      </StickerSurface>
    </PhoneScreen>
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

  avatar: {
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.thick,
    borderRadius: radius.pill,
  },
  avatarInitials: {
    color: colors.ink,
    fontFamily: fontFamily.display,
    // The TV's seat draws a 24px monogram in a 72px circle; this circle is
    // 128px, and the monogram keeps its proportion.
    fontSize: 42,
    lineHeight: 46,
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
