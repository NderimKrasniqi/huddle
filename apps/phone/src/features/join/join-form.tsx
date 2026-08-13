import { api } from '@huddle/convex';
import { AVATAR_IDS, type AvatarId, ROOM_CODE_LENGTH } from '@huddle/domain';
import { colors, elevation } from '@huddle/ui';
import { Avatar, Icon, LoadingIndicator, Surface, Wordmark } from '@huddle/ui/native';
import { useMutation } from 'convex/react';
import * as Crypto from 'expo-crypto';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { PhoneScreen } from '../../ui/native';
import { rememberSession, type PlayerSession } from '../../platform/session';
import { phoneSessionTokenStore } from '../../platform/session/native';
import { phoneIdentityStore } from '../../platform/storage/native';
import {
  activeCodeCell,
  canJoin,
  codeEntry,
  isCodeComplete,
  joinFailureMessage,
  nicknameEntry,
  loadGuestProfile,
  rememberProfile,
  shouldMoveToNickname,
} from './index';
import { styles } from './styles';

const CARET_BLINK_MS = 530;

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
  const [guestId, setGuestId] = useState<string>();
  const [failure, setFailure] = useState<string>();

  // The seat-loss notice stops being the news the moment the player does
  // anything about it — touches a field, or taps Join — so it is dismissed on
  // the first of those rather than lingering over a form they have moved on to.
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const showNotice = notice !== undefined && !noticeDismissed;

  const nameField = useRef<TextInput>(null);
  const joinRoom = useMutation(api.players.joinRoom);
  const router = useRouter();

  // The name this phone last joined under, dropped into the field the way a
  // browser fills a login it has seen before. It only ever *seeds* an empty
  // field: `touched` latches the first keystroke, so a slow read that lands
  // after the player has started typing their own name is ignored rather than
  // allowed to overwrite it. Read once per mount — the form remounts on a new
  // Join Link (see `PhoneScreen`), which re-asks on its own.
  const touched = useRef(false);
  useEffect(() => {
    let active = true;
    void loadGuestProfile(phoneIdentityStore, Crypto.randomUUID).then((remembered) => {
      if (!active) return;
      setGuestId(remembered.guestId);
      if (!touched.current) {
        setAvatar(remembered.avatarId);
        if (remembered.displayName !== '') setNickname(remembered.displayName);
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
      const resolvedGuestId = guestId ?? (await loadGuestProfile(phoneIdentityStore, Crypto.randomUUID)).guestId;
      const { sessionToken, ...seat } = await joinRoom({ code, nickname: claimed, avatar, guestId: resolvedGuestId });
      await rememberSession(phoneSessionTokenStore, sessionToken);
      void rememberProfile(phoneIdentityStore, { version: 1, guestId: resolvedGuestId, displayName: claimed, avatarId: avatar });
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
    <PhoneScreen contentStyle={styles.screen}>
      <View style={styles.header}>
        <Wordmark height={30} />
      </View>

      <Text style={styles.title}>Join the room</Text>

      {showNotice ? (
        <Text style={styles.notice} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.label}>ROOM CODE</Text>
        <CodeTiles code={code} onChange={enterCode} autoFocus={!isCodeComplete(prefilledCode)} />
        <Pressable accessibilityRole="button" className="mt-3 flex-row items-center justify-center gap-2 py-2" onPress={() => router.push('/scan' as Href)}>
          <Icon name="scan" size={18} color={colors.accent} />
          <Text className="font-semibold text-phone-body text-accent">Scan the TV QR code</Text>
        </Pressable>
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
                style={[styles.avatarCell, chosen && styles.avatarChosen]}
                accessibilityRole="radio"
                accessibilityState={{ selected: chosen }}
                accessibilityLabel={id.replace(/-/gu, ' ')}
              >
                <Avatar
                  avatar={id}
                  size={52}
                  shape="tile"
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
          accessibilityState={{ disabled: !ready || joining, busy: joining }}
        >
          {({ pressed }) => (
            <Surface
              elevation={elevation.phoneCard}
              // Dimming belongs to the whole sticker: fading the face alone
              // would leave a solid shadow under a ghosted button.
              style={[[styles.stretch, !ready && styles.buttonUnavailable], [styles.button, pressed && styles.buttonPressed]]}>
              {joining ? (
                <LoadingIndicator size="small" color={colors.inverse} label="Joining room" />
              ) : null}
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
 * their Soft Minimal colors, an accented cell with a blinking caret where the next
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
        style={styles.absoluteFill}
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

/** The blinking accent caret in the active cell, as the handoff draws it. */

function BlinkingCaret() {
  const [shown, setShown] = useState(true);

  useEffect(() => {
    const blink = setInterval(() => setShown((wasShown) => !wasShown), CARET_BLINK_MS);
    return () => clearInterval(blink);
  }, []);

  return <View style={[styles.caret, !shown && styles.caretHidden]} />;
}
