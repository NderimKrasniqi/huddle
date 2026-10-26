import type { GameLogic, GameLogicRegistry } from '@huddle/contracts';
import { triviaGameLogic } from '@huddle/game-trivia/logic';
import { bombSquadGameLogic } from '@huddle/game-bomb-squad/logic';
import { sumoBumpersGameLogic } from '@huddle/game-sumo-bumpers/logic';

import { clampBrowsingIndex } from './browsing';

export const GAME_LOGIC_REGISTRY: GameLogicRegistry = [triviaGameLogic, bombSquadGameLogic, sumoBumpersGameLogic];

export function gameLogicById(gameId: string): GameLogic | undefined {
  return GAME_LOGIC_REGISTRY.find((game) => game.metadata.id === gameId);
}

export function browsingIndex(stored: number | undefined | null): number {
  return clampBrowsingIndex(stored, GAME_LOGIC_REGISTRY.length);
}
