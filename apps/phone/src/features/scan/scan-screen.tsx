import { brandColors, radii, spacing } from '@huddle/design-tokens';
import { HuddleButton, HuddleText, HEARTBEAT_ARTWORK } from '@huddle/ui/native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useIsFocused, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Back to Join Room"
            style={styles.backButton}
            testID="scanner-back"
          >
            <HuddleText variant="title" color={cameraSurface ? 'surface' : 'text'} align="center">×</HuddleText>
          </Pressable>
          <HuddleText variant="body" color={cameraSurface ? 'surface' : 'text'} align="center" style={styles.topTitle}>
            {cameraSurface ? 'Point at the TV\nroom code' : 'Join with QR'}
          </HuddleText>
          <View style={styles.topButtonSpacer} />
        </View>

        <View style={styles.content}>
          {cameraState === 'checking' ? (
            <View style={styles.introContent} testID="scanner-intro">
              <Image
                source={HEARTBEAT_ARTWORK.phone.scanOwlPhone}
                resizeMode="contain"
                style={styles.introArtwork}
                accessible
                accessibilityLabel="An owl holding a phone"
              />
              <HuddleText variant="title" align="center">Scan the code shown on the TV</HuddleText>
              <HuddleButton
                title="Allow camera"
                onPress={tryRequestPermission}
                accessibilityLabel="Allow camera"
                testID="scanner-allow-camera"
                style={styles.recoveryAction}
              />
              <HuddleButton
                title="Enter code instead"
                variant="secondary"
                onPress={goBack}
                accessibilityLabel="Enter room code manually"
                testID="scanner-intro-manual"
                style={styles.recoverySecondaryAction}
              />
            </View>
          ) : cameraState === 'permission' ? (
            <View style={styles.recoveryContent} testID="scanner-permission-card">
              <Image
                source={HEARTBEAT_ARTWORK.phone.cameraUnavailable}
                resizeMode="contain"
                style={styles.recoveryArtwork}
                accessible
                accessibilityLabel="Camera unavailable"
              />
              <HuddleText variant="title" align="center">Camera access is off</HuddleText>
              <HuddleText variant="body" align="center" style={styles.recoveryMessage}>Enable it in Settings or enter the room code.</HuddleText>
              {permission?.canAskAgain ? (
                <HuddleButton title="Allow camera" onPress={tryRequestPermission} accessibilityLabel="Try camera permission again" testID="scanner-permission-retry" style={styles.recoveryAction} />
              ) : (
                <HuddleButton title="Open Settings" onPress={() => void Linking.openSettings()} accessibilityLabel="Open camera settings" testID="scanner-open-settings" style={styles.recoveryAction} />
              )}
              <HuddleButton title="Enter code instead" variant="secondary" onPress={goBack} accessibilityLabel="Enter room code manually" testID="scanner-permission-manual" style={styles.recoverySecondaryAction} />
            </View>
          ) : cameraState === 'error' ? (
            <View style={styles.recoveryContent} testID="scanner-error-card">
              <Image
                source={HEARTBEAT_ARTWORK.phone.cameraUnavailable}
                resizeMode="contain"
                style={styles.recoveryArtwork}
                accessible
                accessibilityLabel="Camera unavailable"
              />
              <HuddleText variant="title" align="center">Camera isn’t available</HuddleText>
              <HuddleText variant="body" align="center" style={styles.recoveryMessage}>You can still join with the code from the TV.</HuddleText>
              <HuddleButton title="Enter code manually" onPress={goBack} accessibilityLabel="Enter room code manually" testID="scanner-manual-fallback" style={styles.recoveryAction} />
              <HuddleButton title="Try camera again" variant="secondary" onPress={() => {
                setCameraError(false);
                requestedForFocusRef.current = false;
                tryRequestPermission();
              }} accessibilityLabel="Try camera again" testID="scanner-camera-retry" style={styles.recoverySecondaryAction} />
            </View>
          ) : (
            <>
              {message ? (
                <View style={styles.scanAlert} testID="scanner-alert">
                  <HuddleText variant="title" align="center" style={styles.alertTitle}>That isn’t a Huddle room code.</HuddleText>
                  <HuddleText variant="body" align="center" color="text" testID="scanner-message" accessibilityRole="alert">{message}</HuddleText>
                  <HuddleButton title="Keep scanning" onPress={() => setMessage(undefined)} accessibilityLabel="Keep scanning" testID="scanner-keep-scanning" style={styles.recoveryAction} />
                  <HuddleButton title="Enter code instead" variant="secondary" onPress={goBack} accessibilityLabel="Enter room code manually" testID="scanner-alert-manual" style={styles.recoverySecondaryAction} />
                </View>
              ) : (
                <View style={styles.frame} accessible accessibilityLabel="QR code scanner frame" testID="scanner-frame">
                  <View style={[styles.corner, styles.cornerTopLeft]} />
                  <View style={[styles.corner, styles.cornerTopRight]} />
                  <View style={[styles.corner, styles.cornerBottomLeft]} />
                  <View style={[styles.corner, styles.cornerBottomRight]} />
                  <HuddleText variant="caption" color="surface" align="center" style={styles.frameHint}>Place the TV code here</HuddleText>
                </View>
              )}
            </>
          )}
        </View>

        {cameraSurface ? (
          <HuddleButton variant="ghost" onPress={goBack} accessibilityLabel="Enter room code manually" testID="scanner-manual-code" style={styles.manualButton}>
            <HuddleText variant="body" color="surface">Enter code manually</HuddleText>
          </HuddleButton>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cameraRoot: { backgroundColor: brandColors.espresso },
  recoveryRoot: { backgroundColor: brandColors.cream },
  cameraTint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: brandColors.espresso, opacity: 0.58 },
  safeArea: { flex: 1, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  backButton: { width: 44, height: 44, borderRadius: radii.round, alignItems: 'center', justifyContent: 'center' },
  topButtonSpacer: { width: 44, height: 44 },
  topTitle: { flex: 1, fontWeight: '700' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  introContent: { width: '100%', maxWidth: 330, alignItems: 'center', gap: spacing.lg },
  introArtwork: { width: '100%', height: 250, marginBottom: spacing.sm },
  recoveryContent: { width: '100%', maxWidth: 330, alignItems: 'center', gap: spacing.md },
  recoveryArtwork: { width: '100%', height: 190, marginBottom: spacing.sm },
  recoveryMessage: { maxWidth: 270, opacity: 0.8 },
  recoveryAction: { width: '100%', minHeight: 50, borderRadius: radii.md },
  recoverySecondaryAction: { width: '100%', minHeight: 48, borderRadius: radii.md },
  frame: { width: '100%', maxWidth: 320, aspectRatio: 1.08, borderRadius: radii.xl, alignItems: 'center', justifyContent: 'center' },
  frameHint: { opacity: 0.8, marginTop: 230 },
  corner: { position: 'absolute', width: 58, height: 58, borderColor: brandColors.cream },
  cornerTopLeft: { top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: radii.lg },
  cornerTopRight: { top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: radii.lg },
  cornerBottomLeft: { bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: radii.lg },
  cornerBottomRight: { bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: radii.lg },
  scanAlert: { width: '100%', maxWidth: 330, alignItems: 'center', gap: spacing.md, padding: spacing.xl, borderRadius: radii.xl, backgroundColor: 'rgba(230,163,177,0.92)' },
  alertTitle: { color: brandColors.espresso },
  alertDetail: { opacity: 0.72 },
  manualButton: { alignSelf: 'center', marginBottom: spacing.lg, borderColor: brandColors.cream, opacity: 0.9 },
});
