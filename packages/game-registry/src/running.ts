import type { GameModule, RunningGame, RunningGameResponse } from '@huddle/contracts';

import { GAME_REGISTRY } from './registry';

export type { RunningGameResponse };

export type RunningGameScreen =
  | { readonly kind: 'lobby' }
  | {
      readonly kind: 'game';
      readonly module: GameModule;
      readonly state: unknown;
      readonly gameId?: string;
      readonly settings?: Readonly<Record<string, string>>;
      readonly mode?: 'quick' | 'standard' | 'custom';
      readonly clockRemainingMs?: number;
    }
  | {
      readonly kind: 'finished';
      readonly module: GameModule;
      readonly state: unknown;
      readonly gameId: string;
      readonly settings?: Readonly<Record<string, string>>;
      readonly mode?: 'quick' | 'standard' | 'custom';
    }
  | {
      readonly kind: 'paused';
      readonly gameId: string;
      readonly reason: 'tvDisconnected' | 'playerDisconnected';
    }
  | { readonly kind: 'unavailable'; readonly gameId: string };

export function gameModuleById(gameId: string): GameModule | undefined {
  return GAME_REGISTRY.find((game) => game.metadata.id === gameId);
}

export function runningGameScreen(
  running: RunningGameResponse | RunningGame | undefined,
): RunningGameScreen {
  if (running === null || running === undefined) {
    return { kind: 'lobby' };
  }

  const response =
    'kind' in running
      ? running
      : { kind: 'running' as const, gameId: running.gameId, state: running.state };

  if (response.kind === 'paused') {
    return { kind: 'paused', gameId: response.gameId, reason: response.reason };
  }

  if (response.kind === 'unavailable') {
    return { kind: 'unavailable', gameId: response.gameId };
  }

  const module = gameModuleById(response.gameId);

  if (module === undefined)
    return { kind: 'unavailable', gameId: response.gameId };

  const state = response.state;
  const finished =
    module.isFinished?.(state) ??
    (typeof state === 'object' &&
      state !== null &&
      'phase' in state &&
      (state as { phase?: unknown }).phase === 'finished');

  if (finished) {
    return {
      kind: 'finished',
      module,
      state,
      gameId: response.gameId,
      ...(response.settings === undefined ? {} : { settings: response.settings }),
      ...(response.mode === undefined ? {} : { mode: response.mode }),
    };
  }

  return {
    kind: 'game',
    module,
    state,
    ...(response.settings === undefined ? {} : { settings: response.settings }),
    ...(response.mode === undefined ? {} : { mode: response.mode }),
    ...(response.clockRemainingMs === undefined
      ? {}
      : { clockRemainingMs: response.clockRemainingMs }),
  };
}
