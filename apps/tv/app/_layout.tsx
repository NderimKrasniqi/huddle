import { ConvexProvider } from 'convex/react';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { useFonts } from '@expo-google-fonts/nunito/useFonts';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { StatusSurface } from '@huddle/ui/native';
import { convexClient } from '../src/platform/convex/native';

void SplashScreen.preventAutoHideAsync();

export default function TvLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const [frameReady, setFrameReady] = useState(false);

  const ready = (fontsLoaded || fontError !== null) && frameReady;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setFrameReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!ready) return;
    void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) {
    return (
      <StatusSurface
        platform="tv"
        variant={fontError ? 'error' : 'loading'}
        systemFont={fontError !== null}
        title={fontError ? "Huddle couldn't start" : 'Starting Huddle…'}
        message={fontError ? 'Huddle could not load its typeface. Restart the app to try again.' : 'Getting things ready'}
      />
    );
  }

  if (fontError) {
    return (
      <StatusSurface
        platform="tv"
        variant="error"
        systemFont
        title="Huddle couldn't start"
        message="Huddle could not load its typeface. Restart the app to try again."
      />
    );
  }

  const app = <Stack screenOptions={{ headerShown: false }} />;
  return convexClient === undefined ? app : <ConvexProvider client={convexClient}>{app}</ConvexProvider>;
}
