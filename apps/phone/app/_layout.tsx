import { huddleFonts } from '@huddle/ui/fonts';
import { ConvexProvider } from 'convex/react';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '../global.css';

import { convexClient } from '../src/platform/convex/native';
import { ConnectivityBanner } from '../src/platform/network/native';
import { PhoneLoadingScreen } from '../src/ui/native';

// Keep the native mark covering the window until the first branded React frame
// can use the real typeface. Calling this at module scope is early enough for
// Expo Router's own automatic splash hide to respect it.
void SplashScreen.preventAutoHideAsync();

export default function PhoneLayout() {
  // Soft Minimal is a typographic system, so hold the first frame until Inter
  // is available rather than flash a fallback face. If a
  // font fails to load, render anyway — degraded type beats a blank screen.
  const [fontsLoaded, fontError] = useFonts(huddleFonts);
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (!ready) return undefined;

    const frame = requestAnimationFrame(() => {
      void SplashScreen.hideAsync();
    });
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  if (!ready) {
    return <PhoneLoadingScreen phase="startup" />;
  }

  return (
    <ConvexProvider client={convexClient}>
      <SafeAreaProvider>
        <ConnectivityBanner />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
        </Stack>
      </SafeAreaProvider>
    </ConvexProvider>
  );
}
