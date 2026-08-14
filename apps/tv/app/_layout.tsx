import { ConvexProvider } from 'convex/react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { TvBootScreen } from '../src/features/boot/native';
import { convexClient } from '../src/platform/convex/native';

void SplashScreen.preventAutoHideAsync();

export default function TvLayout() {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setStarted(true);
      void SplashScreen.hideAsync();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!started) return <TvBootScreen phase="startup" />;

  const app = <Stack screenOptions={{ headerShown: false }} />;
  return convexClient === undefined ? app : <ConvexProvider client={convexClient}>{app}</ConvexProvider>;
}
