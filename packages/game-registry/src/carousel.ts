import type { GameModule } from '@huddle/contracts';

import { clampBrowsingIndex } from './browsing';
import { CAROUSEL_PLACEHOLDERS } from './carousel-placeholders';
import { GAME_REGISTRY } from './registry';

/** The installed games followed by the reference-only cards. */
export const CAROUSEL_REGISTRY: readonly GameModule[] = [
  ...GAME_REGISTRY,
  ...CAROUSEL_PLACEHOLDERS,
];

/**
 * The carousel, as both clients read it: which game is focused, and what sits
 * either side of it.
 *
 * The room stores an *index* into the Registry rather than a game id, because
 * what the Host is doing is browsing an ordered list — "the third card" has to
 * mean the same thing on the television and on the phone, and an id would leave
 * the two to agree on an order separately.
 */

/** The Registry entry at `index`, with the neighbouring cards in the approved carousel. */
export type CarouselWindow = {
  readonly index: number;
  readonly focused: GameModule;
  /** The card to the left, or `undefined` at the start of the list. */
  readonly previous: GameModule | undefined;
  /** The card to the right, or `undefined` at the end of it. */
  readonly next: GameModule | undefined;
  /** How many games there are, for the page dots and the "2 / 3". */
  readonly total: number;
};

/**
 * An index the Registry actually has, from whatever the room stored.
 *
 * Clamped rather than rejected. The index is a position in a list that can
 * change between builds — a phone that browsed to card three in a room whose
 * TV installs two games is not doing anything wrong — and the honest answer to
 * an index off the end is the nearest card, not an error on a television.
 * `undefined` is a room nobody has browsed in yet, which is the first card.
 */
export function browsingIndex(stored: number | undefined | null): number {
  return clampBrowsingIndex(stored, CAROUSEL_REGISTRY.length);
}

/**
 * What the carousel shows at `index`.
 *
 * `undefined` only if nothing is installed, which no build ships — it is here
 * so the screens have something to draw rather than an entry to assume.
 *
 * A card's neighbours are its carousel siblings, and the list does not
 * wrap: the first card's `previous` and the last card's `next` are `undefined`,
 * so the Host's arrows die at the ends rather than looping the focus back to a
 * card already on screen. The installed games lead the list and the two
 * reference-only cards keep the future carousel positions reachable without
 * making those games selectable.
 */
export function carouselWindow(index: number): CarouselWindow | undefined {
  const at = browsingIndex(index);
  const focused = CAROUSEL_REGISTRY[at];

  if (focused === undefined) {
    return undefined;
  }

  return {
    index: at,
    focused,
    previous: CAROUSEL_REGISTRY[at - 1],
    next: CAROUSEL_REGISTRY[at + 1],
    total: CAROUSEL_REGISTRY.length,
  };
}

/** Where the Host's "previous" button goes, or `undefined` if it cannot. */
export function previousIndex(index: number): number | undefined {
  const at = browsingIndex(index);
  return at > 0 ? at - 1 : undefined;
}

/** Where the Host's "next" button goes, or `undefined` if it cannot. */
export function nextIndex(index: number): number | undefined {
  const at = browsingIndex(index);
  return at < CAROUSEL_REGISTRY.length - 1 ? at + 1 : undefined;
}
