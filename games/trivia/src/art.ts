import type { ImageSourcePropType } from 'react-native';

function nativeAsset(load: () => number): ImageSourcePropType {
  try {
    return load();
  } catch {
    return 0;
  }
}

export const TRIVIA_ART = {
  logoDark: nativeAsset(() => require('../assets/logo-dark.png')),
  logoLight: nativeAsset(() => require('../assets/logo-light.png')),
  space: nativeAsset(() => require('../assets/space.jpg')),
  mascot: {
    idle: nativeAsset(() => require('../assets/mascot-idle.png')),
    wave: nativeAsset(() => require('../assets/mascot-wave.png')),
    point: nativeAsset(() => require('../assets/mascot-point.png')),
    celebrate: nativeAsset(() => require('../assets/mascot-celebrate.png')),
  },
} as const;

export const MASCOT_ASPECT = {
  idle: 640 / 533,
  wave: 640 / 475,
  point: 640 / 534,
  celebrate: 640 / 533,
} as const;
