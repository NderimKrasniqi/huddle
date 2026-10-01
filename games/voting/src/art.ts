import type { ImageSourcePropType } from 'react-native';

/**
 * Voting's own artwork. Metro turns each literal require into a native asset
 * id; the guard keeps Node-based logic and contract tests able to import this.
 */
function nativeAsset(load: () => number): ImageSourcePropType {
  try {
    return load();
  } catch {
    return 0;
  }
}

export const VOTING_ART = {
  world: nativeAsset(() => require('../assets/world.png')),
  clouds: nativeAsset(() => require('../assets/clouds.png')),
  room: nativeAsset(() => require('../assets/room.png')),
} as const;
