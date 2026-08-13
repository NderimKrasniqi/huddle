import { huddleFonts } from '@huddle/ui/fonts';
import { ConvexProvider } from 'convex/react';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import '../global.css';

import { convexClient } from '../src/platform/convex/native';
import { TvBootScreen } from '../src/features/boot/native';
import { ConnectivityBanner } from '../src/platform/network/native';

// Do not surrender the native launch surface to an undecoded/unthemed React
// root. The opening screen underneath is already branded when this is hidden.
void SplashScreen.preventAutoHideAsync();

export default function TvLayout() {
  // Soft Minimal is a typographic system, so hold the first frame until Inter
  // is available rather than flash a fallback face. If a
  // font fails to load, render anyway — degraded type beats a blank TV.
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
    return <TvBootScreen phase="startup" />;
  }

  const app = (
    <>
      <ConnectivityBanner />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );

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
