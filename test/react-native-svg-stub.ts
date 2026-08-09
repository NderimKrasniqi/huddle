/**
 * `react-native-svg`, as the Node test runner sees it.
 *
 * The sibling of `react-native-stub.ts`, for the same reason and with the same
 * limits: `@huddle/ui/native` draws the icon set with this package, a Game
 * Module's screens import that barrel, and several tests that never render
 * anything — the Registry's lists, the carousel's arithmetic, the hub's
 * mutations — have to load a module that could. The package ships untranspiled
 * source, so without this the import dies on a stray `typeof` before any
 * assertion runs.
 *
 * The same seam rule holds: nothing here renders, and a test that needed to
 * assert what an icon *draws* would be a decision to start testing renderers
 * rather than a reason to grow this file. What the icons are made of is
 * asserted in `packages/ui/src/icons.test.ts`, against the SVG sources, with no
 * renderer anywhere near it.
 */

export const Svg = (): null => null;
export const Path = (): null => null;
export const Circle = (): null => null;
export const Rect = (): null => null;

export default Svg;
