import { huddleFonts } from '@huddle/ui/fonts';
import { ConvexProvider } from 'convex/react';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';

import { convexClient } from '../src/platform/convex';

export default function TvLayout() {
  // Soft Minimal is a typographic system, so hold the first frame until Inter
  // is available rather than flash a fallback face. If a
  // font fails to load, render anyway — degraded type beats a blank TV.
  const [fontsLoaded, fontError] = useFonts(huddleFonts);
  if (!fontsLoaded && fontError === null) {
    return null;
  }

  const app = <Stack screenOptions={{ headerShown: false }} />;

  // A build with no deployment configured has no client to provide, and must
  // still reach the pairing screen: that screen is where the TV says what is
  // wrong, and it is the only place anybody in the room can be told. The
  // screen's own Convex subscriptions only mount once a room is open, which
  // cannot happen without a client.
  return convexClient === undefined ? (
    app
  ) : (
    <ConvexProvider client={convexClient}>{app}</ConvexProvider>
  );
}
