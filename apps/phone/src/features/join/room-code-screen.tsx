import { type AvatarId } from '@huddle/domain';
import { playroomColors, playroomPhone, playroomRadii, playroomShadows } from '@huddle/design-tokens';
import { PlayroomButton, PlayroomFloat, PlayroomHeading, PlayroomPill, PlayroomText, PlayroomWordmark } from '@huddle/ui/native';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePhoneReducedMotion } from '../../ui/reduced-motion';
import { activeCodeCell, codeEntry, isCodeComplete } from './join-entry';

export type RoomCodeAvailability = {
  readonly full: boolean;
  readonly takenAvatarIds?: readonly AvatarId[];
};

export type RoomCodeScreenProps = {
  readonly code?: string;
  /** `undefined` is the pending query state; `null` is a missing room. */
  readonly availability?: RoomCodeAvailability | null;
  readonly error?: string;
  readonly onCodeChange?: (code: string) => void;
  readonly onContinue: (code: string) => void;
  readonly onScanQr: () => void;
};

/**
 * Join a room: four boxes that match the four tiles on the TV. Identity is a
 * separate route.
 */
export function RoomCodeScreen({
  code: initialCode = '',
  availability,
  error,
  onCodeChange,
  onContinue,
  onScanQr,
}: RoomCodeScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = usePhoneReducedMotion() !== false;
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState(() => codeEntry(initialCode));
  const [focused, setFocused] = useState(false);
  const complete = isCodeComplete(code);
  const pending = complete && availability === undefined;
  const missing = complete && availability === null;
  const full = complete && availability?.full === true;
  const canContinue = complete && availability !== undefined && availability !== null && !full;
  const active = focused ? activeCodeCell(code) : undefined;

  function updateCode(value: string) {
    const next = codeEntry(value);
    setCode(next);
    onCodeChange?.(next);
  }

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={insets.top}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <PlayroomWordmark height={34} testID="huddle-heartbeat-mark" />
          <PlayroomHeading type={playroomPhone.type.heading}>Join a room</PlayroomHeading>
          <PlayroomText color="muted" style={[playroomPhone.type.body, styles.center]}>
            Type the four-letter code on the TV.
          </PlayroomText>

          <Pressable
            onPress={() => inputRef.current?.focus()}
            accessibilityRole="button"
            accessibilityLabel={code ? `Room code ${code.split('').join(' ')}` : 'Enter four-letter room code'}
            accessibilityHint="Opens the keyboard to enter the room code"
            testID="room-code-tiles-button"
            style={styles.boxes}
          >
            {[0, 1, 2, 3].map((position) => (
              <View
                key={position}
                style={[styles.box, position === active ? styles.boxActive : null, missing || full ? styles.boxError : null]}
                testID={position === 0 ? 'heartbeat-room-code' : undefined}
              >
                <PlayroomText style={styles.letter}>{code[position] ?? ''}</PlayroomText>
                {position === active && code[position] === undefined ? <View style={styles.caret} /> : null}
              </View>
            ))}
          </Pressable>
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={updateCode}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            keyboardType="ascii-capable"
            maxLength={4}
            returnKeyType="done"
            onSubmitEditing={() => canContinue && onContinue(code)}
            style={styles.hiddenInput}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            testID="heartbeat-room-code-input"
          />

          {pending ? (
            <PlayroomPill textStyle={playroomPhone.type.caption} style={styles.status}>
              Checking room…
            </PlayroomPill>
          ) : null}
          {missing ? <Notice testID="room-not-found-feedback">No room has that code. Check the TV and try again.</Notice> : null}
          {full ? <Notice testID="room-full-feedback">That room is full. Ask someone to leave before joining.</Notice> : null}
          {canContinue ? (
            <PlayroomPill tone="success" textStyle={playroomPhone.type.caption} style={styles.status}>
              Room found · ready to join
            </PlayroomPill>
          ) : null}
          {error ? <Notice testID="room-code-error">{error}</Notice> : null}

          <PlayroomButton
            label="Join room"
            bursts
            onPress={() => onContinue(code)}
            disabled={!canContinue}
            accessibilityLabel="Continue to pick your vibe"
            testID="continue-to-vibe"
          />
          <View style={styles.or}>
            <View style={styles.rule} />
            <PlayroomText color="muted" style={playroomPhone.type.caption}>or</PlayroomText>
            <View style={styles.rule} />
          </View>
          <PlayroomButton
            label={full ? 'Try another code' : 'Scan the QR code'}
            variant="secondary"
            onPress={full ? () => updateCode('') : onScanQr}
            accessibilityLabel={full ? 'Try another room code' : 'Scan TV room QR code'}
            testID="scan-tv-code"
          />
          <View style={styles.props} pointerEvents="none">
            <PlayroomFloat prop="controller" width={150} height={104} style={{ left: 12, bottom: 0 }} reduceMotion={reduceMotion} />
            <PlayroomFloat prop="starYellow" width={52} height={52} style={{ right: 60, bottom: 30 }} reduceMotion={reduceMotion} delay={80} />
            <PlayroomFloat prop="ballOrange" width={34} height={34} style={{ right: 20, bottom: 6 }} reduceMotion={reduceMotion} delay={160} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Notice({ children, testID }: { readonly children: string; readonly testID: string }) {
  return (
    <View style={styles.notice} accessible accessibilityRole="alert" testID={testID}>
      <PlayroomText color="danger" style={[playroomPhone.type.body, styles.center]}>
        {children}
      </PlayroomText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: playroomColors.canvas,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    paddingHorizontal: playroomPhone.gutter + 4,
    gap: 16,
  },
  center: {
    textAlign: 'center',
  },
  boxes: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  box: {
    flex: 1,
    aspectRatio: 0.82,
    borderRadius: playroomRadii.button,
    backgroundColor: playroomColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...playroomShadows.card,
  },
  boxActive: {
    borderWidth: 3,
    borderColor: playroomColors.ink,
  },
  boxError: {
    borderWidth: 2,
    borderColor: playroomColors.danger,
  },
  letter: {
    ...playroomPhone.type.hero,
    fontSize: 44,
    lineHeight: 50,
  },
  caret: {
    position: 'absolute',
    bottom: '22%',
    width: 22,
    height: 5,
    borderRadius: 3,
    backgroundColor: playroomColors.orange,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  status: {
    alignSelf: 'center',
  },
  notice: {
    padding: 12,
    borderRadius: playroomRadii.input,
    backgroundColor: playroomColors.dangerSurface,
  },
  or: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: playroomColors.border,
  },
  props: {
    flexGrow: 1,
    minHeight: 120,
  },
});
