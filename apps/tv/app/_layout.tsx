import { boardwalkFonts } from '@huddle/ui';
import { ConvexProvider } from 'convex/react';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';

import { convexClient } from '../src/convex-client';

export default function TvLayout() {
  // Boardwalk is a typographic system, so hold the first frame until Bungee
  // and Space Grotesk are available rather than flash a fallback face. If a
  // font fails to load, render anyway — degraded type beats a blank TV.
  const [fontsLoaded, fontError] = useFonts(boardwalkFonts);
  if (!fontsLoaded && fontError === null) {
    return null;
  }

  return (
    <ConvexProvider client={convexClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </ConvexProvider>
  );
}
