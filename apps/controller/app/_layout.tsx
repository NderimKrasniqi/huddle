import { boardwalkFonts } from '@huddle/ui';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';

export default function ControllerLayout() {
  // Boardwalk is a typographic system, so hold the first frame until Bungee
  // and Space Grotesk are available rather than flash a fallback face. If a
  // font fails to load, render anyway — degraded type beats a blank screen.
  const [fontsLoaded, fontError] = useFonts(boardwalkFonts);
  if (!fontsLoaded && fontError === null) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
