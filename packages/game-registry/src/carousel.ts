import type { GameModule } from '@huddle/contracts';

import { clampBrowsingIndex } from './browsing';
import { GAME_REGISTRY } from './registry';

export type CarouselWindow = {
  readonly index: number;
  readonly focused: GameModule;
  readonly previous: GameModule | undefined;
  readonly next: GameModule | undefined;
  readonly total: number;
};

export function browsingIndex(stored: number | undefined | null): number {
  return clampBrowsingIndex(stored, GAME_REGISTRY.length);
}

export function carouselWindow(index: number): CarouselWindow | undefined {
  const at = browsingIndex(index);
  const focused = GAME_REGISTRY[at];

  if (focused === undefined) {
    return undefined;
  }

  return {
    index: at,
    focused,
    previous: GAME_REGISTRY[at - 1],
    next: GAME_REGISTRY[at + 1],
    total: GAME_REGISTRY.length,
  };
}

export function nextIndex(index: number): number | undefined {
  const at = browsingIndex(index);
  return at < GAME_REGISTRY.length - 1 ? at + 1 : undefined;
}
