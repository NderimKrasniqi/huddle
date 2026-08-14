import { ConvexProvider } from 'convex/react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { convexClient } from '../src/platform/convex/native';
import { PhoneLoadingScreen } from '../src/ui/native';

void SplashScreen.preventAutoHideAsync();

export default function PhoneLayout() {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setStarted(true);
      void SplashScreen.hideAsync();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!started) return <PhoneLoadingScreen phase="startup" />;

  return (
    <ConvexProvider client={convexClient}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
        </Stack>
      </SafeAreaProvider>
    </ConvexProvider>
  );
}
