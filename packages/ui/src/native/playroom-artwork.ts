import type { AvatarId, GameSettingIcon } from '@huddle/contracts';
import type { ImageSourcePropType } from 'react-native';

/**
 * Playroom runtime artwork (docs/design/playroom/README.md). Native bundles
 * receive numeric Metro asset handles; the guarded require keeps Node-based
 * contract and render tests able to import this module.
 */
function nativeAsset(load: () => number): ImageSourcePropType {
  try {
    return load();
  } catch {
    return 0;
  }
}

export const PLAYROOM_ARTWORK = {
  brand: {
    wordmark: nativeAsset(() => require('../../assets/playroom/brand/wordmark.png')),
    splash: nativeAsset(() => require('../../assets/playroom/brand/splash.png')),
  },
  moments: {
    lounge: nativeAsset(() => require('../../assets/playroom/moments/game-night-lounge.png')),
    tvHandoff: nativeAsset(() => require('../../assets/playroom/moments/eyes-on-the-tv.png')),
    highFive: nativeAsset(() => require('../../assets/playroom/moments/high-five.png')),
  },
  props: {
    controller: nativeAsset(() => require('../../assets/playroom/props/controller.png')),
    crown: nativeAsset(() => require('../../assets/playroom/props/crown.png')),
    /** A raised hand: this player is ready. */
    hand: nativeAsset(() => require('../../assets/playroom/props/hand.png')),
    starPurple: nativeAsset(() => require('../../assets/playroom/props/star-purple.png')),
    starYellow: nativeAsset(() => require('../../assets/playroom/props/star-yellow.png')),
    ballOrange: nativeAsset(() => require('../../assets/playroom/props/ball-orange.png')),
    ballPurple: nativeAsset(() => require('../../assets/playroom/props/ball-purple.png')),
    ballCream: nativeAsset(() => require('../../assets/playroom/props/ball-cream.png')),
  },
  status: {
    loading: nativeAsset(() => require('../../assets/playroom/status/loading.png')),
    waiting: nativeAsset(() => require('../../assets/playroom/status/waiting.png')),
    roomFull: nativeAsset(() => require('../../assets/playroom/status/room-full.png')),
    roomNotFound: nativeAsset(() => require('../../assets/playroom/status/room-not-found.png')),
    disconnected: nativeAsset(() => require('../../assets/playroom/status/disconnected.png')),
    paused: nativeAsset(() => require('../../assets/playroom/status/paused.png')),
    leftRoom: nativeAsset(() => require('../../assets/playroom/status/left-room.png')),
  },
} as const;

export type PlayroomProp = keyof typeof PLAYROOM_ARTWORK.props;
export type PlayroomStatusArt = keyof typeof PLAYROOM_ARTWORK.status;

/** Portraits without circles; `PlayroomAvatar` draws the circle behind them. */
export const PLAYROOM_AVATARS: Readonly<Record<AvatarId, ImageSourcePropType>> = {
  fox: nativeAsset(() => require('../../assets/playroom/avatars/fox.png')),
  'green-alien': nativeAsset(() => require('../../assets/playroom/avatars/green-alien.png')),
  'pink-bunny': nativeAsset(() => require('../../assets/playroom/avatars/pink-bunny.png')),
  'blue-robot': nativeAsset(() => require('../../assets/playroom/avatars/blue-robot.png')),
  'purple-owl': nativeAsset(() => require('../../assets/playroom/avatars/purple-owl.png')),
  'yellow-robot': nativeAsset(() => require('../../assets/playroom/avatars/yellow-robot.png')),
  'red-robot': nativeAsset(() => require('../../assets/playroom/avatars/red-robot.png')),
  'teal-bear': nativeAsset(() => require('../../assets/playroom/avatars/teal-bear.png')),
  'mint-cat': nativeAsset(() => require('../../assets/playroom/avatars/mint-cat.png')),
  puppy: nativeAsset(() => require('../../assets/playroom/avatars/puppy.png')),
};

/** Setting pictures, by the icon name a game declares on its setting. */
export const PLAYROOM_SETTING_ICONS: Readonly<Record<GameSettingIcon, ImageSourcePropType>> = {
  count: nativeAsset(() => require('../../assets/playroom/settings/count.png')),
  difficulty: nativeAsset(() => require('../../assets/playroom/settings/difficulty.png')),
  timer: nativeAsset(() => require('../../assets/playroom/settings/timer.png')),
  category: nativeAsset(() => require('../../assets/playroom/settings/category.png')),
  scoring: nativeAsset(() => require('../../assets/playroom/settings/scoring.png')),
  results: nativeAsset(() => require('../../assets/playroom/settings/results.png')),
  players: nativeAsset(() => require('../../assets/playroom/settings/players.png')),
};

/**
 * Catalog art for the five registry cards. Coming-soon art is supplied already
 * muted, so a card never needs an image filter.
 */
const GAME_ART: Readonly<Record<string, ImageSourcePropType>> = {
  trivia: nativeAsset(() => require('../../assets/playroom/games/trivia.png')),
  voting: nativeAsset(() => require('../../assets/playroom/games/voting.png')),
  'doodle-dash': nativeAsset(() => require('../../assets/playroom/games/doodle-dash.png')),
  'quick-poll': nativeAsset(() => require('../../assets/playroom/games/quick-poll.png')),
  'hot-take': nativeAsset(() => require('../../assets/playroom/games/hot-take.png')),
};

/** Catalog art for a registry game id, or undefined for a game without any. */
export function playroomGameArt(gameId: string): ImageSourcePropType | undefined {
  return GAME_ART[gameId];
}
