import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  type ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AVATAR_IDS,
  NICKNAME_MAX_LENGTH,
  type AvatarId,
  type GuestProfileV1,
} from '@huddle/domain';
import { huddleAvatarSource } from '@huddle/ui/native';

import {
  activeCodeCell,
  canJoin,
  codeEntry,
  isCodeComplete,
  nicknameEntry,
  shouldMoveToNickname,
} from './join-entry';

const ROOM_CODE_POSITIONS = [0, 1, 2, 3] as const;

const COLORS = {
  canvas: '#FFF8F1',
  surfaceMuted: '#F7EFE6',
  ink: '#202538',
  textMuted: '#657080',
  primary: '#293354',
  accent: '#FF765D',
  border: '#E5DDD4',
  disabled: '#D9D4CE',
} as const;

export type JoinRoomScreenProps = {
  readonly initialCode?: string;
  /** A profile loaded by the route adapter. It is intentionally display-only here. */
  readonly initialProfile?: GuestProfileV1;
  /** `undefined` means the availability query has not answered yet. */
  readonly availability?: {
    readonly full: boolean;
    readonly takenAvatarIds: readonly AvatarId[];
  } | null;
  /** The route adapter has finished loading/creating the durable guest profile. */
  readonly identityReady?: boolean;
  readonly isJoining?: boolean;
  readonly error?: string;
  readonly notice?: string;
  readonly onCodeChange?: (code: string) => void;
  readonly onJoinRoom?: (input: {
    readonly code: string;
    readonly nickname: string;
    readonly avatarId: AvatarId;
  }) => void | Promise<void>;
  readonly onScanQr: () => void;
  /** Native avatar resolver supplied by the platform asset seam. */
  readonly avatarSource?: (avatarId: AvatarId) => ImageSourcePropType | undefined;
};

/** The first illustrated Phone surface restored after the UI clean-slate reset. */
export function JoinRoomScreen({
  initialCode = '',
  initialProfile,
  availability,
  identityReady = true,
  isJoining = false,
  onJoinRoom,
  onScanQr,
  error,
  notice,
  avatarSource = huddleAvatarSource,
  onCodeChange,
}: JoinRoomScreenProps) {
  const inputRef = useRef<TextInput>(null);
  const nameInputRef = useRef<TextInput>(null);
  const [code, setCode] = useState(() => codeEntry(initialCode));
  const [nickname, setNickname] = useState(() => nicknameEntry(initialProfile?.displayName ?? ''));
  const [avatarId, setAvatarId] = useState<AvatarId>(() => initialProfile?.avatarId ?? 'fox');
  const nicknameTouched = useRef(false);
  const avatarTouched = useRef(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const readyToJoin = identityReady && canJoin(code, nickname) && !isJoining && availability?.full !== true &&
    availability?.takenAvatarIds.includes(avatarId) !== true;

  const [pickerDismissed, setPickerDismissed] = useState(false);
  const pickerVisible = pickerOpen || (
    availability?.takenAvatarIds.includes(avatarId) === true && !pickerDismissed
  );
  const selectedAvatarTaken = availability?.takenAvatarIds.includes(avatarId) === true;

  useEffect(() => {
    if (initialProfile === undefined) return;
    // Profile storage is asynchronous. Apply it on the next frame, but do not
    // overwrite somebody who has already started drafting their identity.
    const frame = requestAnimationFrame(() => {
      if (!nicknameTouched.current) setNickname(nicknameEntry(initialProfile.displayName));
      if (!avatarTouched.current) setAvatarId(initialProfile.avatarId);
    });
    return () => cancelAnimationFrame(frame);
  }, [initialProfile]);

  function handleCodeChange(value: string) {
    const next = codeEntry(value);
    setCode(next);
    if (next !== code) setPickerDismissed(false);
    onCodeChange?.(next);

    if (shouldMoveToNickname(code, next)) {
      // Let the controlled code field commit before asking React Native to move
      // the keyboard. This keeps the transition reliable on both iOS and
      // Android without making the hidden code input a second visible focus
      // target.
      requestAnimationFrame(() => nameInputRef.current?.focus());
    }
  }

  function handleNicknameChange(value: string) {
    nicknameTouched.current = true;
    setNickname(nicknameEntry(value));
  }

  function focusCodeInput() {
    inputRef.current?.focus();
  }

  async function handleJoin() {
    if (!readyToJoin) {
      if (!isCodeComplete(code)) {
        focusCodeInput();
      } else {
        nameInputRef.current?.focus();
      }
      return;
    }

    await onJoinRoom?.({ code, nickname: nickname.trim(), avatarId });
  }

  const codeLabel =
    code === ''
      ? 'Enter four-letter room code'
      : `Room code ${code.split('').join(' ')}`;

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      <ImageBackground
        source={require('../../../assets/join-room/join-room-background.png')}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
        accessible={false}
        testID="join-room-background"
      />

      <SafeAreaView
        style={styles.safeArea}
        edges={['top', 'right', 'bottom', 'left']}
      >
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              <View style={styles.brandArea}>
                <Image
                  source={require('../../../assets/join-room/huddle-brand-icon.png')}
                  resizeMode="contain"
                  style={styles.logo}
                  accessible
                  accessibilityLabel="Huddle"
                  testID="huddle-brand-icon"
                />

                <Text style={styles.title}>Join a game!</Text>
                <Text style={styles.subtitle}>
                  {'Enter the 4-letter code\non the TV.'}
                </Text>
              </View>

              <View style={styles.codeSection}>
                <Pressable
                  onPress={focusCodeInput}
                  accessibilityRole="button"
                  accessibilityLabel={codeLabel}
                  accessibilityHint="Opens the keyboard to enter the room code"
                >
                  <View style={styles.codeRow}>
                    {ROOM_CODE_POSITIONS.map((position) => (
                      <CodeBox
                        key={position}
                        position={position}
                        value={code[position]}
                        active={activeCodeCell(code) === position}
                      />
                    ))}
                  </View>
                </Pressable>

                <TextInput
                  ref={inputRef}
                  value={code}
                  onChangeText={handleCodeChange}
                  autoCapitalize="characters"
                  autoComplete="off"
                  autoCorrect={false}
                  spellCheck={false}
                  returnKeyType="done"
                  textContentType="none"
                  onSubmitEditing={() => void handleJoin()}
                  style={styles.hiddenInput}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  testID="room-code-input"
                />
              </View>

              <View style={styles.identityCard} testID="join-identity-card">
                <Pressable
                  onPress={() => {
                    avatarTouched.current = true;
                    setPickerDismissed(false);
                    setPickerOpen(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose avatar, ${avatarLabel(avatarId)}${selectedAvatarTaken ? ', unavailable' : ''}`}
                  accessibilityHint="Opens the avatar picker"
                  style={({ pressed }) => [styles.avatarPreview, pressed && styles.buttonPressed]}
                  testID="selected-avatar-button"
                >
                  {avatarSource?.(avatarId) ? (
                    <Image
                      source={avatarSource(avatarId)}
                      resizeMode="cover"
                      style={styles.avatarImage}
                      accessible={false}
                      testID="selected-avatar-image"
                    />
                  ) : (
                    <Text style={styles.avatarFallback} accessibilityElementsHidden>
                      {avatarId.slice(0, 1).toUpperCase()}
                    </Text>
                  )}
                  <View style={styles.editBadge} accessible={false}>
                    <Text style={styles.editBadgeText}>✎</Text>
                  </View>
                </Pressable>

                <View style={styles.identityFields}>
                  <Text style={styles.fieldLabel}>Display name</Text>
                  <TextInput
                    ref={nameInputRef}
                    value={nickname}
                    onChangeText={handleNicknameChange}
                    placeholder="Your name"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="words"
                    autoCorrect={false}
                    // React Native's maxLength counts UTF-16 code units on
                    // some platforms. Give the controlled code-point
                    // normalizer room for the longest valid astral-character
                    // name while still enforcing the 20-character rule.
                    maxLength={NICKNAME_MAX_LENGTH * 2}
                    returnKeyType="done"
                    onSubmitEditing={() => void handleJoin()}
                    autoFocus={isCodeComplete(code)}
                    style={styles.nameInput}
                    accessibilityLabel="Display name"
                    testID="display-name-input"
                  />
                  <Text style={styles.helperText}>Shown to everyone in the room</Text>
                </View>
              </View>

              {availability?.full === true ? (
                <Text style={styles.feedbackError} accessibilityRole="alert" testID="room-full-feedback">
                  That room is full. Ask someone to leave before joining.
                </Text>
              ) : null}
              {availability === null && isCodeComplete(code) ? (
                <Text style={styles.feedbackError} accessibilityRole="alert" testID="room-not-found-feedback">
                  No room has that code. Check the code on the TV.
                </Text>
              ) : null}
              {selectedAvatarTaken ? (
                <Text style={styles.feedbackError} accessibilityRole="alert" testID="avatar-taken-feedback">
                  That avatar is already in use. Choose another one.
                </Text>
              ) : null}
              {error ? (
                <Text style={styles.feedbackError} accessibilityRole="alert" testID="join-error">
                  {error}
                </Text>
              ) : null}
              {notice ? (
                <Text style={styles.feedbackNotice} accessibilityRole="alert" testID="join-notice">
                  {notice}
                </Text>
              ) : null}

              <View style={styles.actionArea}>
                <Pressable
                  onPress={() => void handleJoin()}
                  disabled={!readyToJoin}
                  accessibilityRole="button"
                  accessibilityLabel="Join Room"
                  accessibilityState={{ disabled: !readyToJoin, busy: isJoining }}
                  style={({ pressed }) => [
                    styles.joinButton,
                    !readyToJoin && styles.joinButtonDisabled,
                    pressed && readyToJoin && styles.buttonPressed,
                  ]}
                >
                  {isJoining ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                      accessibilityRole="progressbar"
                      accessibilityLabel="Joining room"
                      testID="joining-indicator"
                    />
                  ) : (
                    <Text style={styles.joinButtonText}>Join Room</Text>
                  )}
                </Pressable>

                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <Pressable
                  onPress={onScanQr}
                  accessibilityRole="button"
                  accessibilityLabel="Scan QR Code"
                  style={({ pressed }) => [
                    styles.scanButton,
                    pressed && styles.secondaryPressed,
                  ]}
                >
                  <Image
                    source={require('../../../assets/join-room/qr-code-icon.png')}
                    resizeMode="contain"
                    style={styles.scanIcon}
                    accessible={false}
                    testID="qr-code-icon"
                  />
                  <Text style={styles.scanButtonText}>Scan QR Code</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {pickerVisible ? (
        <View style={styles.pickerOverlay} testID="avatar-picker">
          <Pressable
            style={styles.pickerBackdrop}
            onPress={() => {
              setPickerDismissed(true);
              setPickerOpen(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="Close avatar picker"
          />
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Choose avatar</Text>
              <Pressable
                onPress={() => {
                  setPickerDismissed(true);
                  setPickerOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel="Close avatar picker"
                style={styles.pickerClose}
              >
                <Text style={styles.pickerCloseText}>×</Text>
              </Pressable>
            </View>
            <View style={styles.avatarGrid}>
              {AVATAR_IDS.map((candidate) => {
                const taken = availability?.takenAvatarIds.includes(candidate) === true;
                const selected = candidate === avatarId;
                return (
                  <Pressable
                    key={candidate}
                    onPress={() => {
                      if (!taken) {
                        avatarTouched.current = true;
                        setAvatarId(candidate);
                        setPickerDismissed(true);
                        setPickerOpen(false);
                      }
                    }}
                    disabled={taken}
                    accessibilityRole="button"
                    accessibilityLabel={`${avatarLabel(candidate)}${taken ? ', unavailable' : selected ? ', selected' : ''}`}
                    accessibilityState={{ disabled: taken, selected }}
                    style={[styles.avatarOption, selected && styles.avatarOptionSelected, taken && styles.avatarOptionTaken]}
                    testID={`avatar-option-${candidate}`}
                  >
                    {avatarSource?.(candidate) ? (
                      <Image source={avatarSource(candidate)} resizeMode="cover" style={styles.avatarOptionImage} accessible={false} />
                    ) : (
                      <Text style={styles.avatarOptionFallback} accessibilityElementsHidden>
                        {candidate.slice(0, 1).toUpperCase()}
                      </Text>
                    )}
                    {taken ? <Text style={styles.takenMark} accessibilityElementsHidden>×</Text> : null}
                    {selected ? <Text style={styles.selectedMark} accessibilityElementsHidden>✓</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const AVATAR_LABELS: Readonly<Record<AvatarId, string>> = {
  // Stable IDs stay in the data contract, but never become player-facing
  // copy. Neutral ordinal labels also keep the accessibility tree aligned with
  // the approved two-row artwork if the portraits are refreshed later.
  fox: 'Avatar 1',
  'green-alien': 'Avatar 2',
  'pink-bunny': 'Avatar 3',
  'blue-robot': 'Avatar 4',
  'purple-owl': 'Avatar 5',
  'yellow-robot': 'Avatar 6',
  'red-robot': 'Avatar 7',
  'teal-bear': 'Avatar 8',
  'mint-cat': 'Avatar 9',
  puppy: 'Avatar 10',
};

function avatarLabel(avatarId: AvatarId): string {
  return AVATAR_LABELS[avatarId];
}

type CodeBoxProps = {
  readonly position: number;
  readonly value?: string;
  readonly active: boolean;
};

function CodeBox({ position, value, active }: CodeBoxProps) {
  const filled = value !== undefined && value !== '';

  return (
    <View
      style={[
        styles.codeBox,
        active && styles.codeBoxActive,
        filled && styles.codeBoxFilled,
      ]}
      testID={`room-code-cell-${position + 1}`}
    >
      <Text style={styles.codeCharacter}>{value ?? ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  brandArea: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 54 : 76,
  },
  logo: {
    width: 74,
    height: 74,
    marginBottom: 24,
  },
  title: {
    color: COLORS.ink,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 18,
    color: COLORS.primary,
    fontSize: 19,
    lineHeight: 27,
    fontWeight: '500',
    textAlign: 'center',
  },
  codeSection: {
    marginTop: 48,
    alignItems: 'center',
  },
  codeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  codeBox: {
    width: 66,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.74)',
    shadowColor: COLORS.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 5,
    elevation: 2,
  },
  codeBoxActive: {
    borderColor: COLORS.accent,
    borderWidth: 2,
  },
  codeBoxFilled: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
  },
  codeCharacter: {
    color: COLORS.primary,
    fontSize: 43,
    lineHeight: 48,
    fontWeight: '800',
    textAlign: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  actionArea: {
    marginTop: 42,
    width: '100%',
  },
  joinButton: {
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.17,
    shadowRadius: 10,
    elevation: 3,
  },
  joinButtonDisabled: {
    backgroundColor: COLORS.disabled,
    shadowOpacity: 0,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 22,
    paddingHorizontal: 74,
    gap: 14,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    color: COLORS.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  scanButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 29,
    backgroundColor: 'rgba(255, 255, 255, 0.40)',
    gap: 12,
  },
  secondaryPressed: {
    backgroundColor: COLORS.surfaceMuted,
  },
  scanIcon: {
    width: 26,
    height: 26,
  },
  scanButtonText: {
    color: COLORS.primary,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  identityCard: {
    marginTop: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.74)',
    shadowColor: COLORS.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarPreview: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D9D3FF',
    borderWidth: 3,
    borderColor: '#8B68FF',
    overflow: 'visible',
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 48 },
  avatarFallback: { color: COLORS.primary, fontSize: 42, fontWeight: '800' },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: COLORS.ink,
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  editBadgeText: { color: COLORS.primary, fontSize: 18, fontWeight: '700' },
  identityFields: { flex: 1, minWidth: 0 },
  fieldLabel: { color: COLORS.primary, fontSize: 16, lineHeight: 20, fontWeight: '700' },
  nameInput: {
    height: 48,
    marginTop: 6,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: '700',
    backgroundColor: 'rgba(255, 255, 255, 0.56)',
  },
  helperText: { marginTop: 6, color: COLORS.textMuted, fontSize: 13, lineHeight: 17 },
  feedbackError: { marginTop: 10, color: '#B83F3F', fontSize: 14, lineHeight: 19, textAlign: 'center', fontWeight: '600' },
  feedbackNotice: { marginTop: 10, color: COLORS.primary, fontSize: 14, lineHeight: 19, textAlign: 'center', fontWeight: '600' },
  pickerOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'flex-end' },
  pickerBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(32, 37, 56, 0.28)' },
  pickerSheet: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#FFFDFC' },
  pickerHandle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#CDC6BF' },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 20 },
  pickerTitle: { color: COLORS.primary, fontSize: 26, lineHeight: 32, fontWeight: '800' },
  pickerClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceMuted },
  pickerCloseText: { color: COLORS.primary, fontSize: 28, lineHeight: 30, fontWeight: '500' },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18 },
  avatarOption: { width: '18%', aspectRatio: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAE6FF', borderWidth: 2, borderColor: 'transparent' },
  avatarOptionSelected: { borderColor: '#3E9BFF' },
  avatarOptionTaken: { opacity: 0.36 },
  avatarOptionImage: { width: '100%', height: '100%', borderRadius: 999 },
  avatarOptionFallback: { color: COLORS.primary, fontSize: 22, fontWeight: '800' },
  selectedMark: { position: 'absolute', right: -4, bottom: -3, width: 24, height: 24, borderRadius: 12, textAlign: 'center', color: '#FFFFFF', backgroundColor: '#3E9BFF', fontSize: 18, lineHeight: 23, fontWeight: '800' },
  takenMark: { position: 'absolute', width: 26, height: 26, borderRadius: 13, textAlign: 'center', color: '#FFFFFF', backgroundColor: '#657080', fontSize: 22, lineHeight: 24, fontWeight: '700' },
});
