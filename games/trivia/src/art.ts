import type { ImageSourcePropType } from 'react-native';

/**
 * Trivia's own artwork. Metro turns each literal require into a native asset
 * id; the guard keeps Node-based logic and contract tests able to import this.
 */
function nativeAsset(load: () => number): ImageSourcePropType {
  try {
    return load();
  } catch {
    return 0;
  }
}

export const TRIVIA_ART = {
  world: nativeAsset(() => require('../assets/world.png')),
  card: nativeAsset(() => require('../assets/card.png')),
  leaves: nativeAsset(() => require('../assets/leaves.png')),
  tvReveal: nativeAsset(() => require('../assets/tv-reveal.png')),
} as const;
