/**
 * What a bundler hands back for an imported image.
 *
 * The apps get this from `expo/types` through their generated `expo-env.d.ts`,
 * but `packages/ui` typechecks itself against `tsconfig.base.json` and pulls in
 * no Expo types — that is deliberate, and it is what keeps the token half of
 * this package runnable under plain Node. So the one declaration the components
 * actually need is written out here rather than bought with a dependency on
 * Expo's whole type surface.
 *
 * The number is not a placeholder. Metro registers each asset and returns an
 * opaque numeric handle; React Native's `ImageSourcePropType` accepts it, and
 * nothing may read it as anything but a token to hand back to `<Image>`.
 */
declare module '*.png' {
  const asset: number;
  export default asset;
}
