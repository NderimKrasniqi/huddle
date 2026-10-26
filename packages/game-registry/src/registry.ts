import type { GameRegistry } from '@huddle/contracts';
import { triviaGameModule } from '@huddle/game-trivia';
import { bombSquadGameModule } from '@huddle/game-bomb-squad';
import { sumoBumpersGameModule } from '@huddle/game-sumo-bumpers';

export const GAME_REGISTRY: GameRegistry = [triviaGameModule, bombSquadGameModule, sumoBumpersGameModule];
