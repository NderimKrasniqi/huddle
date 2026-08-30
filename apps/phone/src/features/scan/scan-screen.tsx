import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useIsFocused, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
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
      // A subsequent focus entry gets one fresh automatic permission attempt.
      // Keeping this reset tied to the focus transition avoids re-prompting in
      // response to the permission response object changing after a denial.
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

    if (
      permission == null ||
      permission.granted ||
      !permission.canAskAgain ||
      requestedForFocusRef.current
    ) {
      return;
    }

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

  return (
    <View style={styles.root} testID="qr-scanner-screen">
      {focused && cameraState === 'ready' ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          active={focused}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          // Keep the callback mounted while the native preview is alive. The
          // ref inside handleBarcode closes the tiny race before React can
          // render a changed prop after the first accepted scan.
          onBarcodeScanned={handleBarcode}
          onMountError={() => setCameraError(true)}
          testID="qr-camera-view"
        />
      ) : null}

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Back to Join Room"
            style={styles.topButton}
            testID="scanner-back"
          >
            <Text style={styles.topButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.title}>Scan to join</Text>
          <View style={styles.topButtonSpacer} />
        </View>

        <View style={styles.content}>
          {cameraState === 'checking' ? (
            <View style={styles.messageCard}>
              <ActivityIndicator color="#FFFFFF" accessibilityLabel="Checking camera permission" />
              <Text style={styles.messageTitle}>Starting camera…</Text>
            </View>
          ) : cameraState === 'permission' ? (
            <View style={styles.messageCard} testID="scanner-permission-card">
              <Text style={styles.messageTitle}>Camera access needed</Text>
              <Text style={styles.messageBody}>Allow camera access to scan the room code on your TV.</Text>
              {permission?.canAskAgain ? (
                <Pressable onPress={tryRequestPermission} style={styles.primaryButton} accessibilityRole="button" accessibilityLabel="Try camera permission again">
                  <Text style={styles.primaryButtonText}>Try again</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => void Linking.openSettings()} style={styles.primaryButton} accessibilityRole="button" accessibilityLabel="Open camera settings">
                  <Text style={styles.primaryButtonText}>Open Settings</Text>
                </Pressable>
              )}
            </View>
          ) : cameraState === 'error' ? (
            <View style={styles.messageCard} testID="scanner-error-card">
              <Text style={styles.messageTitle}>Camera unavailable</Text>
              <Text style={styles.messageBody}>You can enter the room code manually instead.</Text>
              <Pressable onPress={goBack} style={styles.primaryButton} accessibilityRole="button" accessibilityLabel="Enter room code manually">
                <Text style={styles.primaryButtonText}>Enter code manually</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.frame} accessible accessibilityLabel="QR code scanner frame">
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>
          )}

          <View style={styles.instructionCard}>
            <Text style={styles.instructionTitle}>Point at the TV</Text>
            <Text style={styles.instructionBody}>Place the Huddle QR code inside the frame.</Text>
            {message ? <Text style={styles.scanError} accessibilityRole="alert" testID="scanner-message">{message}</Text> : null}
          </View>
        </View>

        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Enter room code manually" style={styles.manualButton} testID="scanner-manual-code">
          <Text style={styles.manualButtonText}>Enter code manually</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#10152F' },
  safeArea: { flex: 1, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
  topButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)' },
  topButtonSpacer: { width: 44, height: 44 },
  topButtonText: { color: '#FFFFFF', fontSize: 40, lineHeight: 38, fontWeight: '300' },
  title: { color: '#FFFFFF', fontSize: 22, lineHeight: 28, fontWeight: '800' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  frame: { width: '100%', maxWidth: 340, aspectRatio: 1, borderRadius: 24 },
  corner: { position: 'absolute', width: 56, height: 56, borderColor: '#FF765D' },
  cornerTopLeft: { top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 24 },
  cornerTopRight: { top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 24 },
  cornerBottomLeft: { bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 24 },
  cornerBottomRight: { bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 24 },
  messageCard: { width: '100%', maxWidth: 340, alignItems: 'center', padding: 26, borderRadius: 24, backgroundColor: 'rgba(13,19,64,0.84)' },
  messageTitle: { marginTop: 10, color: '#FFFFFF', fontSize: 22, lineHeight: 28, fontWeight: '800', textAlign: 'center' },
  messageBody: { marginTop: 10, color: 'rgba(255,255,255,0.78)', fontSize: 16, lineHeight: 22, textAlign: 'center' },
  primaryButton: { marginTop: 20, minHeight: 50, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 25, backgroundColor: '#FF765D' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, lineHeight: 20, fontWeight: '800' },
  instructionCard: { marginTop: 34, alignItems: 'center' },
  instructionTitle: { color: '#FFFFFF', fontSize: 21, lineHeight: 26, fontWeight: '800', textAlign: 'center' },
  instructionBody: { marginTop: 8, color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 20, textAlign: 'center' },
  scanError: { marginTop: 12, color: '#FFB7A9', fontSize: 14, lineHeight: 19, textAlign: 'center', fontWeight: '700' },
  manualButton: { alignSelf: 'center', marginBottom: 18, padding: 12 },
  manualButtonText: { color: '#FFFFFF', fontSize: 16, lineHeight: 20, fontWeight: '700', textDecorationLine: 'underline' },
});
