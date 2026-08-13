import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { decodeJoinQr, shouldHandleScan } from './scan-payload';

export function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [failure, setFailure] = useState<string>();
  const [isLocked, setIsLocked] = useState(false);
  const locked = useRef(false);

  const onBarcodeScanned = useCallback((result: BarcodeScanningResult) => {
    if (!shouldHandleScan(locked.current)) return;
    const decoded = decodeJoinQr(result.data);
    if (decoded.kind === 'malformed') {
      setFailure('That QR code is not a Huddle room link. Try the code shown on the TV.');
      return;
    }
    locked.current = true;
    setIsLocked(true);
    router.replace({ pathname: '/join/[code]', params: { code: decoded.code } });
  }, [router]);

  if (permission === null) {
    return <View className="flex-1 items-center justify-center bg-canvas"><Text className="font-regular text-phone-body text-ink">Checking camera access…</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 justify-center gap-6 bg-canvas px-6">
        <Text className="font-bold text-phone-title text-ink">Scan room code</Text>
        <Text className="font-regular text-phone-body text-muted">Huddle uses the camera only to read the QR code on your TV.</Text>
        <Pressable
          accessibilityRole="button"
          className="min-h-12 items-center justify-center rounded-button bg-accent px-6"
          onPress={() => permission.canAskAgain ? void requestPermission() : void Linking.openSettings()}
        >
          <Text className="font-semibold text-phone-body text-inverse">{permission.canAskAgain ? 'Allow camera' : 'Open settings'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" className="items-center py-3" onPress={() => router.back()}>
          <Text className="font-semibold text-phone-body text-ink">Enter code manually</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-ink">
      <CameraView
        active
        className="flex-1"
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={isLocked ? undefined : onBarcodeScanned}
        onMountError={() => setFailure('The camera is unavailable. Enter the room code manually.')}
      />
      <View className="absolute inset-x-0 bottom-0 gap-3 bg-ink/80 px-6 pb-10 pt-6">
        <Text className="text-center font-semibold text-phone-heading text-inverse">Point at the TV QR code</Text>
        {failure === undefined ? null : <Text accessibilityLiveRegion="polite" className="text-center font-regular text-phone-body text-inverse">{failure}</Text>}
        <Pressable accessibilityRole="button" className="items-center rounded-button bg-surface py-3" onPress={() => router.back()}>
          <Text className="font-semibold text-phone-body text-ink">Enter code manually</Text>
        </Pressable>
      </View>
    </View>
  );
}
