import { api } from '@huddle/convex';
import { AVATAR_IDS, type AvatarId, ROOM_CODE_LENGTH } from '@huddle/game-core';
import { colors, elevation } from '@huddle/ui';
import { Avatar, Icon, Surface, Wordmark } from '@huddle/ui/native';
import { useMutation } from 'convex/react';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PhoneScreen, controllerStyles as styles } from '../../ui';
import { phoneSessionTokenStore, rememberSession, type PlayerSession } from '../../platform/session';
import { phoneIdentityStore } from '../../platform/storage';
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
} from './index';

const CARET_BLINK_MS = 530;
const AVATAR_TILE = 64;

export function JoinForm({
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
