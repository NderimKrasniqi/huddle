import type { AvatarId } from '@huddle/contracts';

/**
 * Runtime avatar artwork is deliberately resolved here, next to the shared
 * native UI entry point. Convex and game logic continue to exchange only the
 * stable `AvatarId`; this module is the sole presentation mapping.
 */
/**
 * Metro turns a literal image require into a numeric native asset id. The
 * guarded wrapper keeps the pure Node/Vitest contract suites importable too:
 * those suites never render native artwork, and their ESM loader quite
 * correctly cannot evaluate a PNG as JavaScript. Native bundles always take
 * the first branch and receive the real asset id.
 */
function nativeAsset(load: () => number): number {
  try {
    return load();
  } catch {
    return 0;
  }
}

const AVATAR_SOURCES: Readonly<Record<AvatarId, number>> = {
  fox: nativeAsset(() => require('../../assets/avatars/fox.png')),
  'green-alien': nativeAsset(() => require('../../assets/avatars/green-alien.png')),
  'pink-bunny': nativeAsset(() => require('../../assets/avatars/pink-bunny.png')),
  'blue-robot': nativeAsset(() => require('../../assets/avatars/blue-robot.png')),
  'purple-owl': nativeAsset(() => require('../../assets/avatars/purple-owl.png')),
  'yellow-robot': nativeAsset(() => require('../../assets/avatars/yellow-robot.png')),
  'red-robot': nativeAsset(() => require('../../assets/avatars/red-robot.png')),
  'teal-bear': nativeAsset(() => require('../../assets/avatars/teal-bear.png')),
  'mint-cat': nativeAsset(() => require('../../assets/avatars/mint-cat.png')),
  puppy: nativeAsset(() => require('../../assets/avatars/puppy.png')),
};

/** Returns the bundled native image source for a stable avatar id. */
export function huddleAvatarSource(avatarId: AvatarId): number {
  return AVATAR_SOURCES[avatarId];
}

export { AVATAR_SOURCES };
