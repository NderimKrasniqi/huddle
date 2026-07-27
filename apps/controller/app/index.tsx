import { api } from '@huddle/convex';
import { ROOM_CODE_LENGTH } from '@huddle/game-core';
import {
  borderWidth,
  codeLetterColor,
  colors,
  fontFamily,
  letterSpacing,
  offsetShadow,
  opacity,
  playerInitials,
  radius,
  shadowDepth,
} from '@huddle/ui';
import { useMutation } from 'convex/react';
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
  // The code a scanned Join Link brought with it, if the phone arrived that
  // way. Delivering it is the QR task's job (docs/implementation-plan.md);
  // taking it as given is this screen's, and it is the only difference a
  // scanned join makes — the nickname is still typed.
  const { code: linkedCode } = useLocalSearchParams<{ code?: string }>();
  const prefilledCode = codeEntry(linkedCode ?? '');

  const [code, setCode] = useState(prefilledCode);
  const [nickname, setNickname] = useState('');
  const [joining, setJoining] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [seatedAs, setSeatedAs] = useState<string>();

  const nameField = useRef<TextInput>(null);
  const joinRoom = useMutation(api.players.joinRoom);

  if (seatedAs !== undefined) {
    return <YoureInScreen code={code} nickname={seatedAs} />;
  }

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
      await joinRoom({ code, nickname: claimed });
      setSeatedAs(claimed);
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
        {/* The Boardwalk surface is the wrapper's, not the field's: React
            Native only accepts a hard offset shadow on a view style. */}
        <View style={styles.nameField}>
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
        </View>
      </View>

      <View style={styles.field}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            !ready && styles.buttonUnavailable,
            pressed && styles.buttonPressed,
          ]}
          disabled={!ready || joining}
          onPress={() => void join()}
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready || joining }}
        >
          <Text style={styles.buttonLabel}>{joining ? 'Joining…' : 'Join →'}</Text>
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
 * name in the room's own words.
 *
 * The handoff puts a color picker on this screen. Color Claim is a Phase 2 task
 * and the server has nothing to claim a color with yet, so the picker is left
 * out and the avatar is a plain Boardwalk face — the same circle the TV draws
 * on its seats until a color is claimed.
 */
function YoureInScreen({
  code,
  nickname,
}: {
  readonly code: string;
  readonly nickname: string;
}) {
  return (
    <PhoneScreen>
      <View style={styles.seatedHeader}>
        <Text style={styles.logoSmall}>
          HUDDLE<Text style={styles.logoPeriod}>.</Text>
        </Text>
        <View style={styles.codeChip}>
          <Text style={styles.codeChipText}>{code}</Text>
        </View>
      </View>

      <View style={styles.avatar}>
        <Text style={styles.avatarInitials}>{playerInitials(nickname)}</Text>
      </View>

      <Text style={styles.title}>You’re in, {nickname}!</Text>

      <View style={styles.statusCard}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>Eyes on the TV — your name is up there now.</Text>
      </View>
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

  nameField: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.medium,
    borderRadius: radius.input,
    boxShadow: offsetShadow(shadowDepth.phoneSmall),
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
    boxShadow: offsetShadow(shadowDepth.phoneCard),
  },
  buttonUnavailable: {
    opacity: opacity.unavailable,
  },
  // Boardwalk's press: the button travels into its own shadow, which shortens
  // by exactly as far as the button moved.
  buttonPressed: {
    transform: [{ translateX: PRESS_TRAVEL }, { translateY: PRESS_TRAVEL }],
    boxShadow: offsetShadow(shadowDepth.phoneCard - PRESS_TRAVEL),
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
    boxShadow: offsetShadow(shadowDepth.phoneSmall),
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
    boxShadow: offsetShadow(shadowDepth.phoneHero),
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
    boxShadow: offsetShadow(shadowDepth.phoneCard),
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
