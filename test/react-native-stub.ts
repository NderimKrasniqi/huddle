/**
 * `react-native`, as the Node test runner sees it.
 *
 * Nothing here renders. The repo deliberately does not test renderers
 * (docs/tech-stack.md), but several things it *does* test — the Registry's two
 * lists, the carousel's arithmetic, the hub's mutations — have to import a Game
 * Module, and since the phone answer screen a module reaches React Native
 * through its `screens`. React Native ships Flow-typed source that Node cannot
 * parse, so without this the import fails before any assertion runs.
 *
 * This is a seam, not a renderer: it exists so that a test which never draws
 * anything can load a module that could. If a test ever needs to assert what a
 * screen *renders*, it does not belong here — that is a decision to start
 * testing renderers, which is a change to the testing strategy and not a change
 * to this file.
 */

/** `StyleSheet.create` is identity at runtime; the types are the whole point of it. */
export const StyleSheet = {
  create: <T>(styles: T): T => styles,
  flatten: (style: unknown): unknown => style,
  absoluteFillObject: {},
  hairlineWidth: 1,
};

/**
 * The components a screen composes. They are never mounted, so each is a
 * function that returns nothing rather than anything React would recognise —
 * a stub that pretended to render would invite exactly the test this file says
 * does not belong here.
 */
export const View = (): null => null;
export const Text = (): null => null;
export const Pressable = (): null => null;
export const Image = (): null => null;
export const ScrollView = (): null => null;

/**
 * Animated is imported by shared loading primitives but never driven by Node
 * tests. These inert shapes keep import-only package and Registry tests at the
 * same renderer boundary as the components above.
 */
class AnimatedValue {
  setValue(): void {}
  stopAnimation(): void {}
  interpolate(): number {
    return 0;
  }
}

const inertAnimation = {
  start: (): void => {},
  stop: (): void => {},
};

export const Animated = {
  Value: AnimatedValue,
  View,
  delay: () => inertAnimation,
  loop: () => inertAnimation,
  sequence: () => inertAnimation,
  timing: () => inertAnimation,
};

const identity = (value: number): number => value;
export const Easing = {
  quad: identity,
  cubic: identity,
  in: (easing: typeof identity) => easing,
  out: (easing: typeof identity) => easing,
  inOut: (easing: typeof identity) => easing,
};

export const Platform = { OS: 'node', select: (options: Record<string, unknown>) => options.default };
export const Dimensions = { get: () => ({ width: 0, height: 0, scale: 1, fontScale: 1 }) };
export const useWindowDimensions = () => ({ width: 0, height: 0, scale: 1, fontScale: 1 });
