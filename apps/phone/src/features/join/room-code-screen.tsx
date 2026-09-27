import { brandColors, fontFamilies, radii, spacing } from '@huddle/design-tokens';
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
  const [inputFocused, setInputFocused] = useState(false);
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
                Enter the 4-character code from the TV
              </HuddleText>
            </View>

            <View style={styles.codeBlock}>
              <Pressable
                onPress={focusCode}
                style={styles.codeEntry}
                accessibilityRole="button"
                accessibilityLabel={code ? `Room code ${code.split('').join(' ')}` : 'Enter four-letter room code'}
                accessibilityHint="Opens the keyboard to enter the room code"
                testID="room-code-tiles-button"
              >
                <CodeTiles
                  code={code}
                  focusedIndex={inputFocused ? activeCodeCell(code) : undefined}
                  error={missing || full}
                  testID="heartbeat-room-code"
                  style={styles.codeTiles}
                  tileStyle={styles.codeTile}
                  valueStyle={styles.codeValue}
                />
              </Pressable>
              <TextInput
                ref={inputRef}
                value={code}
                onChangeText={updateCode}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
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
                variant={canContinue ? 'primary' : 'secondary'}
                onPress={() => onContinue(code)}
                disabled={!canContinue}
                accessibilityLabel="Continue to pick your vibe"
                testID="continue-to-vibe"
                style={canContinue ? styles.primaryAction : styles.disabledAction}
              >
                <HuddleText variant="body" style={[styles.continueLabel, !canContinue && styles.disabledLabel]}>Continue</HuddleText>
              </HuddleButton>
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
                    <View style={styles.qrIcon} accessible={false}>
                      <View style={styles.qrFinder} /><View style={styles.qrFinder} />
                      <View style={styles.qrFinder} />
                      <View style={styles.qrPixels}><View style={styles.qrPixel} /><View style={styles.qrPixel} /></View>
                    </View>
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
  content: { width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: 36, paddingTop: 10, gap: spacing['2xl'] },
  environmentArtwork: { backgroundColor: brandColors.cream },
  environmentImage: { top: '24%', height: '76%' },
  environmentVeil: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: brandColors.cream, opacity: 0.08 },
  brand: { alignItems: 'center', gap: spacing.sm },
  brandMark: { width: 46, height: 42, marginBottom: spacing.sm, transform: [{ scale: 1.45 }] },
  title: { fontSize: 36, lineHeight: 44, letterSpacing: -0.3 },
  subtitle: { fontSize: 16, lineHeight: 22, opacity: 0.9 },
  codeBlock: { alignItems: 'center', gap: spacing.lg },
  codeEntry: { width: '100%' },
  codeTiles: { width: '100%', gap: spacing.md },
  codeTile: { flex: 1, width: undefined, height: 76, borderRadius: radii.md, borderColor: 'rgba(174,119,58,0.46)', backgroundColor: 'rgba(255,255,255,0.18)', shadowOpacity: 0, elevation: 0 },
  codeValue: { fontSize: 38, lineHeight: 46 },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  notice: { minHeight: 42, width: '100%', borderRadius: radii.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  noticeNeutral: { backgroundColor: 'rgba(255,255,255,0.48)', borderColor: 'rgba(43,31,23,0.18)' },
  noticeSuccess: { backgroundColor: brandColors.mint, borderColor: brandColors.mint },
  noticeError: { backgroundColor: 'rgba(230,163,177,0.32)', borderColor: brandColors.dustyRose },
  noticeFull: { backgroundColor: brandColors.butter, borderColor: brandColors.butter },
  statusIcon: { width: 22, height: 22, borderRadius: radii.round, alignItems: 'center', justifyContent: 'center', backgroundColor: brandColors.mint },
  actions: { gap: spacing['2xl'], paddingBottom: spacing.lg },
  actionsEmpty: { marginTop: spacing['3xl'] },
  primaryAction: { minHeight: 64, borderRadius: radii.md },
  disabledAction: { minHeight: 64, borderRadius: radii.md, backgroundColor: 'rgba(43,31,23,0.10)', borderWidth: 0, opacity: 1 },
  secondaryAction: { minHeight: 60, borderRadius: radii.md, borderColor: 'rgba(43,31,23,0.8)', backgroundColor: 'rgba(255,255,255,0.2)', shadowOpacity: 0, elevation: 0 },
  continueLabel: { fontFamily: fontFamilies.bold, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  disabledLabel: { color: 'rgba(43,31,23,0.5)' },
  qrIcon: { width: 22, height: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  qrFinder: { width: 9, height: 9, borderWidth: 2, borderColor: brandColors.espresso, borderRadius: 1 },
  qrPixels: { width: 9, height: 9, justifyContent: 'space-between' },
  qrPixel: { width: 4, height: 4, backgroundColor: brandColors.espresso },
  buttonLabel: { fontFamily: fontFamilies.bold, fontSize: 18, fontWeight: '700' },
});
