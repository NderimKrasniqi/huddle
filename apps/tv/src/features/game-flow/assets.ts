import type { ImageSourcePropType } from 'react-native';

/**
 * The TV flow owns only the pixels needed to present the installed games.
 * Server and registry state still supply the ids, titles, and settings.
 */
export const TV_GAME_FLOW_ASSETS = {
  background: require('../../../assets/game-flow/backgrounds/huddle-playroom-1080p.png'),
  mark: require('../../../assets/game-flow/brand/huddle-mark.png'),
  cards: {
    trivia: require('../../../assets/game-flow/carousel-cards/trivia-card-source.png'),
    voting: require('../../../assets/game-flow/carousel-cards/voting-card-source.png'),
    'word-battle': require('../../../assets/game-flow/carousel-cards/word-battle-card-source.png'),
    'more-games': require('../../../assets/game-flow/carousel-cards/more-games-card-source.png'),
  },
  art: {
    trivia: require('../../../assets/game-flow/game-art/trivia-game-art-1080p.png'),
    voting: require('../../../assets/game-flow/game-art/voting-game-art-1080p.png'),
  },
  setupIcons: {
    questions: require('../../../assets/game-flow/setup-icons/questions.png'),
    rounds: require('../../../assets/game-flow/setup-icons/rounds.png'),
  },
} as const satisfies {
  background: ImageSourcePropType;
  mark: ImageSourcePropType;
  cards: Record<string, ImageSourcePropType>;
  art: Record<string, ImageSourcePropType>;
  setupIcons: Record<string, ImageSourcePropType>;
};

export type TvGameFlowGameId = keyof typeof TV_GAME_FLOW_ASSETS.cards;
export type TvInstalledGameId = keyof typeof TV_GAME_FLOW_ASSETS.art;

export function gameCardAsset(gameId: string): ImageSourcePropType | undefined {
  return TV_GAME_FLOW_ASSETS.cards[gameId as TvGameFlowGameId];
}

export function gameArtAsset(gameId: string): ImageSourcePropType | undefined {
  return TV_GAME_FLOW_ASSETS.art[gameId as TvInstalledGameId];
}
