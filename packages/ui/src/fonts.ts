import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';

import { fontFamily } from './typography';

/**
 * The font assets Soft Minimal needs, keyed by the family names in
 * `fontFamily`. Both apps hand this map to `useFonts` from `expo-font` in their
 * root layout; the loading itself stays in the apps because gating the first
 * render is an app concern, and `expo-font` is a native module that must
 * resolve to the app's own copy.
 *
 * The imports are deliberately subpaths: the package's root entry point also
 * re-exports a `useFonts` hook, which would pull `expo-font` and `react` into
 * this otherwise asset-only package.
 *
 * Four weights of one family, where Boardwalk loaded two families. The count is
 * the same and the payload is smaller, which matters on the television: these
 * block the first frame.
 */
export const huddleFonts = {
  [fontFamily.regular]: Inter_400Regular,
  [fontFamily.medium]: Inter_500Medium,
  [fontFamily.semibold]: Inter_600SemiBold,
  [fontFamily.bold]: Inter_700Bold,
};
