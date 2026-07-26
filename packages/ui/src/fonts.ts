import { Bungee_400Regular } from '@expo-google-fonts/bungee/400Regular';
import { SpaceGrotesk_400Regular } from '@expo-google-fonts/space-grotesk/400Regular';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';

import { fontFamily } from './typography';

/**
 * The font assets Boardwalk needs, keyed by the family names in `fontFamily`.
 * Both apps hand this map to `useFonts` from `expo-font` in their root layout;
 * the loading itself stays in the apps because gating the first render is an
 * app concern, and `expo-font` is a native module that must resolve to the
 * app's own copy.
 *
 * The imports are deliberately subpaths: each package's root entry point also
 * re-exports a `useFonts` hook, which would pull `expo-font` and `react` into
 * this otherwise asset-only package.
 */
export const boardwalkFonts = {
  [fontFamily.display]: Bungee_400Regular,
  [fontFamily.body]: SpaceGrotesk_400Regular,
  [fontFamily.bodyMedium]: SpaceGrotesk_500Medium,
  [fontFamily.bodyBold]: SpaceGrotesk_700Bold,
};
