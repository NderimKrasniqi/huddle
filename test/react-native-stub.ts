/**
 * Import-only React Native seam for Node tests.
 *
 * Unit suites load game metadata and the registry without mounting native
 * screens. Runtime values needed while evaluating screen modules are inert;
 * render assertions use the app Jest projects.
 */
export const View = (): null => null;
export const Text = (): null => null;
export const Image = (): null => null;
export const ImageBackground = (): null => null;
export const ScrollView = (): null => null;
export const Pressable = (): null => null;
export const ActivityIndicator = (): null => null;

export const StyleSheet = {
  absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  absoluteFillObject: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
};

export const AccessibilityInfo = {
  isReduceMotionEnabled: async () => false,
  addEventListener: () => ({ remove: (): void => {} }),
};

export const AppState = {
  currentState: 'active',
  addEventListener: () => ({ remove: (): void => {} }),
};

export const Platform = {
  OS: 'node',
  select: (options: Record<string, unknown>) => options.default,
};

export const Dimensions = {
  get: () => ({ width: 0, height: 0, scale: 1, fontScale: 1 }),
};

export const useWindowDimensions = () => ({ width: 0, height: 0, scale: 1, fontScale: 1 });
