import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
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

import { activeCodeCell, codeEntry, isCodeComplete } from './join-entry';

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
  readonly isJoining?: boolean;
  readonly onJoinRoom?: (code: string) => void | Promise<void>;
  readonly onScanQr: () => void;
};

/** The first illustrated Phone surface restored after the UI clean-slate reset. */
export function JoinRoomScreen({
  initialCode = '',
  isJoining = false,
  onJoinRoom,
  onScanQr,
}: JoinRoomScreenProps) {
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState(() => codeEntry(initialCode));
  const canJoin = isCodeComplete(code) && !isJoining;

  function handleCodeChange(value: string) {
    setCode(codeEntry(value));
  }

  function focusCodeInput() {
    inputRef.current?.focus();
  }

  async function handleJoin() {
    if (!canJoin) {
      focusCodeInput();
      return;
    }

    await onJoinRoom?.(code);
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

              <View style={styles.actionArea}>
                <Pressable
                  onPress={() => void handleJoin()}
                  disabled={!canJoin}
                  accessibilityRole="button"
                  accessibilityLabel="Join Room"
                  accessibilityState={{ disabled: !canJoin, busy: isJoining }}
                  style={({ pressed }) => [
                    styles.joinButton,
                    !canJoin && styles.joinButtonDisabled,
                    pressed && canJoin && styles.buttonPressed,
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
    </View>
  );
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
});
