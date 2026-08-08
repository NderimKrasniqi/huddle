import { huddleFonts } from '@huddle/ui/fonts';
import { ConvexProvider } from 'convex/react';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { convexClient } from '../src/convex-client';

export default function ControllerLayout() {
  // Boardwalk is a typographic system, so hold the first frame until Bungee
  // and Space Grotesk are available rather than flash a fallback face. If a
  // font fails to load, render anyway — degraded type beats a blank screen.
  const [fontsLoaded, fontError] = useFonts(huddleFonts);
  if (!fontsLoaded && fontError === null) {
    return null;
  }

  return (
    <ConvexProvider client={convexClient}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </ConvexProvider>
  );
}
