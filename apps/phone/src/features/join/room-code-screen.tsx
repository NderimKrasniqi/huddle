import { brandColors, radii, spacing } from '@huddle/design-tokens';
import { CodeTiles, HuddleButton, HuddleText, HEARTBEAT_ARTWORK, ScreenShell } from '@huddle/ui/native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type AvatarId } from '@huddle/domain';
import { activeCodeCell, codeEntry, isCodeComplete } from './join-entry';
import { usePhoneReducedMotion } from '../../ui/reduced-motion';

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

/** Heartbeat room-code entry; identity is deliberately a separate route. */
export function RoomCodeScreen({
  code: initialCode = '',
  availability,
  error,
  onCodeChange,
  onContinue,
  onScanQr,
}: RoomCodeScreenProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = usePhoneReducedMotion();
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState(() => codeEntry(initialCode));
  const [opacity] = useState(() => new Animated.Value(0));
  const complete = isCodeComplete(code);
  const pending = complete && availability === undefined;
  const missing = complete && availability === null;
  const full = complete && availability?.full === true;
  const canContinue = complete && availability !== undefined && availability !== null && !full;

  useEffect(() => {
    if (reducedMotion !== false) {
      opacity.setValue(1);
      return;
    }
    Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [opacity, reducedMotion]);

  function updateCode(value: string) {
    const next = codeEntry(value);
    setCode(next);
    onCodeChange?.(next);
  }

  function focusCode() {
    inputRef.current?.focus();
  }

  return (
    <ScreenShell tone="background" style={styles.root}>
      <ImageBackground
        source={HEARTBEAT_ARTWORK.phone.manualJoinRoom}
        resizeMode="stretch"
        style={[StyleSheet.absoluteFill, styles.environmentArtwork]}
        imageStyle={styles.environmentImage}
        accessible={false}
        testID="heartbeat-manual-join-room"
      >
        <View pointerEvents="none" style={styles.environmentVeil} />
      </ImageBackground>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, spacing.lg), paddingBottom: insets.bottom + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.content, { opacity }]}> 
            <View style={styles.brand}>
              <Image
                source={HEARTBEAT_ARTWORK.brand.displayMark}
                resizeMode="contain"
                style={styles.brandMark}
                accessible
                accessibilityLabel="Huddle"
                testID="huddle-heartbeat-mark"
              />
              <HuddleText variant="title" align="center" style={styles.title}>Join a room</HuddleText>
              <HuddleText variant="body" align="center" style={styles.subtitle}>
                Enter the 4-character code from the TV.
              </HuddleText>
            </View>

            <View style={styles.codeBlock}>
              <Pressable
                onPress={focusCode}
                accessibilityRole="button"
                accessibilityLabel={code ? `Room code ${code.split('').join(' ')}` : 'Enter four-letter room code'}
                accessibilityHint="Opens the keyboard to enter the room code"
                testID="room-code-tiles-button"
              >
                <CodeTiles
                  code={code}
                  focusedIndex={activeCodeCell(code)}
                  error={missing || full}
                  testID="heartbeat-room-code"
                  style={styles.codeTiles}
                />
              </Pressable>
              <TextInput
                ref={inputRef}
                value={code}
                onChangeText={updateCode}
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
                <View style={[styles.notice, styles.noticeNeutral]} accessible accessibilityLiveRegion="polite">
                  <ActivityIndicator color={brandColors.coral} size="small" accessible={false} />
                  <HuddleText variant="body">Checking room…</HuddleText>
                </View>
              ) : null}
              {missing ? (
                <View style={[styles.notice, styles.noticeError]} accessible accessibilityRole="alert" testID="room-not-found-feedback">
                  <HuddleText variant="body" align="center">No room has that code. Check the TV and try again.</HuddleText>
                </View>
              ) : null}
              {full ? (
                <View style={[styles.notice, styles.noticeFull]} accessible accessibilityRole="alert" testID="room-full-feedback">
                  <HuddleText variant="body" align="center">That room is full. Ask someone to leave before joining.</HuddleText>
                </View>
              ) : null}
              {complete && !pending && !missing && !full ? (
                <View style={[styles.notice, styles.noticeSuccess]} accessible accessibilityLiveRegion="polite">
                  <View style={styles.statusIcon}><HuddleText variant="body" color="text">✓</HuddleText></View>
                  <HuddleText variant="body">Room found · ready to join</HuddleText>
                </View>
              ) : null}
              {error ? <View style={[styles.notice, styles.noticeError]} accessible accessibilityRole="alert" testID="room-code-error"><HuddleText variant="body" align="center">{error}</HuddleText></View> : null}
            </View>

            <View style={[styles.actions, !complete && styles.actionsEmpty]}>
              <HuddleButton
                title="Continue"
                variant={canContinue ? 'primary' : 'secondary'}
                onPress={() => onContinue(code)}
                disabled={!canContinue}
                accessibilityLabel="Continue to pick your vibe"
                testID="continue-to-vibe"
                style={canContinue ? styles.primaryAction : styles.disabledAction}
              />
              <HuddleButton
                title={full ? 'Try another code' : undefined}
                variant="secondary"
                onPress={full ? () => updateCode('') : onScanQr}
                accessibilityLabel={full ? 'Try another room code' : 'Scan TV room QR code'}
                testID="scan-tv-code"
                style={styles.secondaryAction}
              >
                {full ? null : (
                  <>
                    <HuddleText variant="body" color="text" accessible={false} style={styles.qrGlyph}>
                      ▦
                    </HuddleText>
                    <HuddleText variant="body" color="text" style={styles.buttonLabel}>
                      Scan QR code
                    </HuddleText>
                  </>
                )}
              </HuddleButton>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 0, overflow: 'hidden' },
  keyboard: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { width: '100%', maxWidth: 390, alignSelf: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing['2xl'] },
  environmentArtwork: { backgroundColor: brandColors.cream },
  environmentImage: { top: '24%', height: '76%' },
  environmentVeil: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: brandColors.cream, opacity: 0.08 },
  brand: { alignItems: 'center', gap: spacing.sm },
  brandMark: { width: 46, height: 42, marginBottom: spacing.sm },
  title: { letterSpacing: -0.3 },
  subtitle: { maxWidth: 300, opacity: 0.9 },
  codeBlock: { alignItems: 'center', gap: spacing.lg },
  codeTiles: { transform: [{ scale: 1.28 }] },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  notice: { minHeight: 42, width: '100%', borderRadius: radii.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  noticeNeutral: { backgroundColor: 'rgba(255,255,255,0.48)', borderColor: 'rgba(43,31,23,0.18)' },
  noticeSuccess: { backgroundColor: brandColors.mint, borderColor: brandColors.mint },
  noticeError: { backgroundColor: 'rgba(230,163,177,0.32)', borderColor: brandColors.dustyRose },
  noticeFull: { backgroundColor: brandColors.butter, borderColor: brandColors.butter },
  statusIcon: { width: 22, height: 22, borderRadius: radii.round, alignItems: 'center', justifyContent: 'center', backgroundColor: brandColors.mint },
  actions: { gap: spacing.lg, paddingBottom: spacing.lg },
  actionsEmpty: { marginTop: spacing['4xl'] },
  primaryAction: { minHeight: 52, borderRadius: radii.md },
  disabledAction: { minHeight: 52, borderRadius: radii.md, backgroundColor: 'rgba(43,31,23,0.10)', borderColor: 'rgba(43,31,23,0.10)', opacity: 1 },
  secondaryAction: { minHeight: 50, borderRadius: radii.md, backgroundColor: 'rgba(255,255,255,0.2)' },
  qrGlyph: { fontSize: 18, lineHeight: 20, fontWeight: '800' },
  buttonLabel: { fontWeight: '700' },
});
