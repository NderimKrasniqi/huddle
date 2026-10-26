import type { GameSettings, GameSetupMode } from '@huddle/domain';
import { settingsFrom, settingsRefusalForMode } from '@huddle/domain';
import { gameLogicById } from '@huddle/game-registry/logic';

import { Refusal } from './refusal';
import type { Setup } from './state';

export function withoutCountdown(setup: Setup): Setup {
  const { countdownEndsAt: _endsAt, ...rest } = setup;
  return { ...rest, stage: setup.stage === 'countdown' ? 'ready' : setup.stage };
}

export function setupForGame(gameId: string, mode: GameSetupMode | undefined, chosen: GameSettings | undefined) {
  const game = gameLogicById(gameId);
  if (game === undefined) throw new Refusal({ kind: 'gameNotInstalled', gameId });
  const resolvedMode = mode ?? 'standard';
  const preset =
    resolvedMode === 'custom'
      ? undefined
      : game.settingsPresentation?.presets?.find((candidate) => candidate.mode === resolvedMode)?.settings;
  const settings = chosen ?? preset ?? settingsFrom(game.settingsSchema, undefined);
  const refusal = settingsRefusalForMode(game.settingsSchema, game.settingsPresentation, settings, resolvedMode);
  if (refusal !== null) throw new Refusal(refusal);
  return { game, settings, mode: resolvedMode };
}
