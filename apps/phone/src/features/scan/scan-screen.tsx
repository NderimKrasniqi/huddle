import { playroomColors, playroomPhone, playroomRadii } from '@huddle/design-tokens';
import { PlayroomButton, PlayroomStatusImage, PlayroomText } from '@huddle/ui/native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useIsFocused, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  StatusBar,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { decodeJoinQr } from './scan-payload';

/** Branded QR scanner route; camera is mounted only while this route is focused. */
export function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const focused = useIsFocused();
  const lockedRef = useRef(false);
  const requestedForFocusRef = useRef(false);
  const wasFocusedRef = useRef(false);
  const [message, setMessage] = useState<string>();
  const [cameraError, setCameraError] = useState(false);
  const cameraState = cameraError
    ? 'error'
    : permission == null
      ? 'checking'
      : permission.granted
        ? 'ready'
        : 'permission';

  useEffect(() => {
    if (!focused) {
      wasFocusedRef.current = false;
      return;
    }

    if (!wasFocusedRef.current) {
      wasFocusedRef.current = true;
      requestedForFocusRef.current = false;
      lockedRef.current = false;
      setMessage(undefined);
      setCameraError(false);
    }

    if (permission == null || permission.granted || !permission.canAskAgain || requestedForFocusRef.current) return;
    requestedForFocusRef.current = true;
    void requestPermission().catch(() => setCameraError(true));
  }, [focused, permission, requestPermission]);

  function tryRequestPermission() {
    requestedForFocusRef.current = true;
    void requestPermission().catch(() => setCameraError(true));
  }

  function handleBarcode({ data }: BarcodeScanningResult) {
    if (lockedRef.current) return;
    const result = decodeJoinQr(data);
    if (result.kind === 'malformed') {
      setMessage('That QR code is not a Huddle room code. Keep scanning.');
      return;
    }
    lockedRef.current = true;
    setMessage(undefined);
    router.replace(`/join/${result.code}`);
  }

  function goBack() {
    router.back();
  }

  const cameraSurface = cameraState === 'ready';

  return (
    <View style={[styles.root, cameraSurface ? styles.cameraRoot : styles.recoveryRoot]} testID="qr-scanner-screen">
      <StatusBar barStyle={cameraSurface ? 'light-content' : 'dark-content'} />
      {focused && cameraSurface ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          active={focused}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcode}
          onMountError={() => setCameraError(true)}
          testID="qr-camera-view"
        />
      ) : null}
      {cameraSurface ? <View pointerEvents="none" style={styles.cameraTint} /> : null}
      <SafeAreaView style={styles.safeArea} edges={cameraSurface ? ['top', 'left', 'right'] : undefined}>
        <View style={styles.topBar}>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel={cameraSurface ? 'Scan to join, back' : 'Back'}
            accessibilityHint="Returns to the room code screen"
            hitSlop={12}
            style={styles.backButton}
            testID="scanner-back"
          >
            <PlayroomText color={cameraSurface ? 'surface' : 'ink'} style={styles.backChevron}>‹</PlayroomText>
            <PlayroomText color={cameraSurface ? 'surface' : 'ink'} style={playroomPhone.type.label}>
              {cameraSurface ? 'Scan to join' : 'Back'}
            </PlayroomText>
          </Pressable>
        </View>

        <View style={[styles.content, cameraSurface && !message ? styles.cameraContent : null]}>
          {cameraState === 'checking' ? (
            <View style={styles.introContent} testID="scanner-intro">
              <PlayroomStatusImage art="waiting" width={220} height={220} />
              <PlayroomText style={[playroomPhone.type.heading, styles.center]}>Scan the code shown on the TV</PlayroomText>
              <PlayroomButton label="Allow camera"
                onPress={tryRequestPermission}
                accessibilityLabel="Allow camera"
                testID="scanner-allow-camera"
                style={styles.recoveryAction}
              />
              <PlayroomButton label="Enter code instead"
                variant="secondary"
                onPress={goBack}
                accessibilityLabel="Enter room code manually"
                testID="scanner-intro-manual"
                style={styles.recoverySecondaryAction}
              />
            </View>
          ) : cameraState === 'permission' ? (
            <View style={styles.recoveryContent} testID="scanner-permission-card">
              <PlayroomStatusImage art="disconnected" width={190} height={190} />
              <PlayroomText style={[playroomPhone.type.heading, styles.center]}>Camera access is off</PlayroomText>
              <PlayroomText style={[playroomPhone.type.body, styles.center, styles.recoveryMessage]}>Enable it in Settings or enter the room code.</PlayroomText>
              {permission?.canAskAgain ? (
                <PlayroomButton label="Allow camera" onPress={tryRequestPermission} accessibilityLabel="Try camera permission again" testID="scanner-permission-retry" style={styles.recoveryAction} />
              ) : (
                <PlayroomButton label="Open Settings" onPress={() => void Linking.openSettings()} accessibilityLabel="Open camera settings" testID="scanner-open-settings" style={styles.recoveryAction} />
              )}
              <PlayroomButton label="Enter code instead" variant="secondary" onPress={goBack} accessibilityLabel="Enter room code manually" testID="scanner-permission-manual" style={styles.recoverySecondaryAction} />
            </View>
          ) : cameraState === 'error' ? (
            <View style={styles.recoveryContent} testID="scanner-error-card">
              <PlayroomStatusImage art="disconnected" width={190} height={190} />
              <PlayroomText style={[playroomPhone.type.heading, styles.center]}>Camera isn’t available</PlayroomText>
              <PlayroomText style={[playroomPhone.type.body, styles.center, styles.recoveryMessage]}>You can still join with the code from the TV.</PlayroomText>
              <PlayroomButton label="Enter code manually" onPress={goBack} accessibilityLabel="Enter room code manually" testID="scanner-manual-fallback" style={styles.recoveryAction} />
              <PlayroomButton label="Try camera again" variant="secondary" onPress={() => {
                setCameraError(false);
                requestedForFocusRef.current = false;
                tryRequestPermission();
              }} accessibilityLabel="Try camera again" testID="scanner-camera-retry" style={styles.recoverySecondaryAction} />
            </View>
          ) : (
            <>
              {message ? (
                <View style={styles.scanAlert} testID="scanner-alert">
                  <PlayroomText style={[playroomPhone.type.heading, styles.center, styles.alertTitle]}>That isn’t a Huddle room code.</PlayroomText>
                  <PlayroomText color="ink" testID="scanner-message" accessibilityRole="alert" style={[playroomPhone.type.body, styles.center]}>{message}</PlayroomText>
                  <PlayroomButton label="Keep scanning" onPress={() => setMessage(undefined)} accessibilityLabel="Keep scanning" testID="scanner-keep-scanning" style={styles.recoveryAction} />
                  <PlayroomButton label="Enter code instead" variant="secondary" onPress={goBack} accessibilityLabel="Enter room code manually" testID="scanner-alert-manual" style={styles.recoverySecondaryAction} />
                </View>
              ) : (
                <View style={styles.frame} accessible accessibilityLabel="QR code scanner frame" testID="scanner-frame">
                  <View style={[styles.corner, styles.cornerTopLeft]} />
                  <View style={[styles.corner, styles.cornerTopRight]} />
                  <View style={[styles.corner, styles.cornerBottomLeft]} />
                  <View style={[styles.corner, styles.cornerBottomRight]} />
                </View>
              )}
              {message ? null : (
                <PlayroomText color="surface" style={[playroomPhone.type.label, styles.center, styles.caption]}>
                  Point your camera at the QR code on the TV
                </PlayroomText>
              )}
            </>
          )}
        </View>

      </SafeAreaView>
      {cameraSurface && !message ? (
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.grab} />
          <PlayroomButton label="Type the code instead" variant="secondary" onPress={goBack} accessibilityLabel="Enter room code manually" testID="scanner-manual-code" />
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { textAlign: 'center' },
  cameraRoot: { backgroundColor: playroomColors.ink },
  recoveryRoot: { backgroundColor: playroomColors.canvas },
  cameraTint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: playroomColors.ink, opacity: 0.58 },
  safeArea: { flex: 1, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: playroomPhone.gutter + 4, paddingTop: 8 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: playroomPhone.minTarget },
  backChevron: { fontSize: 30, lineHeight: 32 },
  caption: { maxWidth: 280, marginTop: 32 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  cameraContent: { paddingBottom: 48 },
  introContent: { width: '100%', maxWidth: 330, alignItems: 'center', gap: 24 },
  recoveryContent: { width: '100%', maxWidth: 330, alignItems: 'center', gap: 16 },
  recoveryMessage: { maxWidth: 270, opacity: 0.8 },
  recoveryAction: { width: '100%', minHeight: 50, borderRadius: playroomRadii.input },
  recoverySecondaryAction: { width: '100%', minHeight: 48, borderRadius: playroomRadii.input },
  frame: { width: '100%', maxWidth: 320, aspectRatio: 1.08, borderRadius: playroomRadii.card, alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: 58, height: 58, borderColor: playroomColors.orange },
  cornerTopLeft: { top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: playroomRadii.button },
  cornerTopRight: { top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: playroomRadii.button },
  cornerBottomLeft: { bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: playroomRadii.button },
  cornerBottomRight: { bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: playroomRadii.button },
  scanAlert: { width: '100%', maxWidth: 330, alignItems: 'center', gap: 16, padding: 32, borderRadius: playroomRadii.card, backgroundColor: playroomColors.dangerSurface },
  alertTitle: { color: playroomColors.ink },
  sheet: { width: '100%', gap: 12, paddingHorizontal: playroomPhone.gutter + 4, paddingTop: 10, paddingBottom: 16, borderTopLeftRadius: playroomRadii.card, borderTopRightRadius: playroomRadii.card, backgroundColor: playroomColors.canvas },
  grab: { alignSelf: 'center', width: 44, height: 5, borderRadius: playroomRadii.pill, backgroundColor: playroomColors.border },
});
