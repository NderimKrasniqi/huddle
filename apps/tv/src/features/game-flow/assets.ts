import type { ImageSourcePropType } from 'react-native';

import { HEARTBEAT_ARTWORK } from '@huddle/ui/native';

/**
 * The TV flow owns no artwork. This map is the small display-only adapter
 * from the registry ids to the reviewed Heartbeat asset manifest in the
 * shared UI package. Server and registry state still supply ids, titles, and
 * settings.
 */
export const TV_GAME_FLOW_ASSETS = {
  background: HEARTBEAT_ARTWORK.tv.platformStage,
  mark: HEARTBEAT_ARTWORK.brand.displayMark,
  cards: {
    trivia: HEARTBEAT_ARTWORK.gameCards.trivia,
    voting: HEARTBEAT_ARTWORK.gameCards.voting,
    'doodle-dash': HEARTBEAT_ARTWORK.gameCards.doodleDash,
    'quick-poll': HEARTBEAT_ARTWORK.gameCards.quickPoll,
    'hot-take': HEARTBEAT_ARTWORK.gameCards.hotTake,
  },
  art: {
    trivia: HEARTBEAT_ARTWORK.gameWorlds.trivia,
    voting: HEARTBEAT_ARTWORK.gameWorlds.voting,
  },
} as const satisfies {
  background: ImageSourcePropType;
  mark: ImageSourcePropType;
  cards: Record<string, ImageSourcePropType>;
  art: Record<string, ImageSourcePropType>;
};

export type TvGameFlowGameId = keyof typeof TV_GAME_FLOW_ASSETS.cards;
export type TvInstalledGameId = keyof typeof TV_GAME_FLOW_ASSETS.art;

export function gameCardAsset(gameId: string): ImageSourcePropType | undefined {
  return TV_GAME_FLOW_ASSETS.cards[gameId as TvGameFlowGameId];
}

export function gameArtAsset(gameId: string): ImageSourcePropType | undefined {
  return TV_GAME_FLOW_ASSETS.art[gameId as TvInstalledGameId];
}
