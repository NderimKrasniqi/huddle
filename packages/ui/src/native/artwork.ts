import type { ImageSourcePropType } from 'react-native';

/**
 * Runtime artwork is copied from the current temporary Heartbeat assets into
 * this package so native bundles never resolve an image from the design docs.
 *
 * The values are numeric Metro asset handles in Phone/TV bundles. A guarded
 * require keeps contract and render tests that run in Node able to import the
 * shared entry point without teaching their ESM loader about PNG files.
 */
function nativeAsset(load: () => number): ImageSourcePropType {
  try {
    return load();
  } catch {
    return 0;
  }
}

export const HEARTBEAT_ARTWORK = {
  brand: {
    displayMark: nativeAsset(() => require('../../assets/heartbeat/brand/huddle-display-mark.png')),
    launcherMark: nativeAsset(() => require('../../assets/heartbeat/brand/huddle-launcher-mark.png')),
  },
  phone: {
    joinEnvironment: nativeAsset(() => require('../../assets/heartbeat/phone/join-environment.png')),
    manualJoinRoom: nativeAsset(() => require('../../assets/heartbeat/phone/manual-join-room.png')),
    identityEnvironment: nativeAsset(() => require('../../assets/heartbeat/phone/identity-environment.png')),
    identitySunnyHero: nativeAsset(() => require('../../assets/heartbeat/phone/identity-sunny-hero.png')),
    scanOwlPhone: nativeAsset(() => require('../../assets/heartbeat/phone/scan-owl-phone.png')),
    cameraUnavailable: nativeAsset(() => require('../../assets/heartbeat/phone/camera-unavailable.png')),
    guestWaiting: nativeAsset(() => require('../../assets/heartbeat/phone/guest-waiting.png')),
    gamePaused: nativeAsset(() => require('../../assets/heartbeat/phone/game-paused.png')),
    seatLost: nativeAsset(() => require('../../assets/heartbeat/phone/seat-lost.png')),
    gameFinished: nativeAsset(() => require('../../assets/heartbeat/phone/game-finished.png')),
  },
  tv: {
    platformStage: nativeAsset(() => require('../../assets/heartbeat/tv/platform-stage.png')),
    platformLivingRoom: nativeAsset(() => require('../../assets/heartbeat/tv/platform-living-room.png')),
    setupRequired: nativeAsset(() => require('../../assets/heartbeat/tv/setup-required.png')),
    deviceUnavailable: nativeAsset(() => require('../../assets/heartbeat/tv/device-unavailable.png')),
  },
  gameCards: {
    trivia: nativeAsset(() => require('../../assets/heartbeat/game-cards/trivia.png')),
    voting: nativeAsset(() => require('../../assets/heartbeat/game-cards/voting.png')),
    doodleDash: nativeAsset(() => require('../../assets/heartbeat/game-cards/doodle-dash.png')),
    quickPoll: nativeAsset(() => require('../../assets/heartbeat/game-cards/quick-poll.png')),
    hotTake: nativeAsset(() => require('../../assets/heartbeat/game-cards/hot-take.png')),
  },
  gameWorlds: {
    trivia: nativeAsset(() => require('../../assets/heartbeat/game-worlds/trivia.png')),
    voting: nativeAsset(() => require('../../assets/heartbeat/game-worlds/voting.png')),
  },
} as const;

export type HeartbeatArtwork = typeof HEARTBEAT_ARTWORK;
