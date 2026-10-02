import type { ImageSourcePropType } from 'react-native';

/**
 * Trivia's own artwork: the Cosmic Quiz logo, its alien mascot and the TV's
 * night sky. Metro turns each literal require into a native asset id; the guard
 * keeps Node-based logic and contract tests able to import this.
 */
function nativeAsset(load: () => number): ImageSourcePropType {
  try {
    return load();
  } catch {
    return 0;
  }
}

export const TRIVIA_ART = {
  /** Logo for dark backgrounds (the TV). 2:1. */
  logoDark: nativeAsset(() => require('../assets/logo-dark.png')),
  /** Logo for light backgrounds (the phones). 2:1. */
  logoLight: nativeAsset(() => require('../assets/logo-light.png')),
  /** The TV's starfield and planet. 16:9, opaque, so a JPEG. */
  space: nativeAsset(() => require('../assets/space.jpg')),
  mascot: {
    /** Peeking over an edge, hands down: while a question is up. */
    idle: nativeAsset(() => require('../assets/mascot-idle.png')),
    /** Waving: the intro. */
    wave: nativeAsset(() => require('../assets/mascot-wave.png')),
    /** Pointing up at the TV: answer locked and the reveal. */
    point: nativeAsset(() => require('../assets/mascot-point.png')),
    /** Holding a star: the finished game. */
    celebrate: nativeAsset(() => require('../assets/mascot-celebrate.png')),
  },
} as const;

/** Width ÷ height of each mascot pose, so a screen can size one by width. */
export const MASCOT_ASPECT = {
  idle: 640 / 533,
  wave: 640 / 475,
  point: 640 / 534,
  celebrate: 640 / 533,
} as const;
