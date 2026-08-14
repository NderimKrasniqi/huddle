/**
 * Import-only React Native seam for Node tests.
 *
 * Unit suites load game metadata and the registry without mounting native
 * screens. The only runtime values needed by those imports are inert View and
 * Text component functions; render assertions use the app Jest projects.
 */
export const View = (): null => null;
export const Text = (): null => null;

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
