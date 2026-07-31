/**
 * The carousel index, clamped — with no Registry in sight.
 *
 * It takes the list's length rather than reading a list, and that is the whole
 * reason this file exists: the server needs this arithmetic, and every route to
 * it that went through `./carousel` dragged `GAME_REGISTRY` — and therefore
 * every installed game's React Native screens — into the Convex bundle. It did,
 * once, silently. Nothing here may import a Registry.
 */

/**
 * A position `total` items actually have, from whatever a room stored.
 *
 * Clamped rather than rejected. The index is a position in a list that can
 * change between builds — a phone that browsed to card three in a room whose TV
 * installs two games is not doing anything wrong — and the honest answer to an
 * index off the end is the nearest card, not an error on a television. Absent
 * is a room nobody has browsed in yet, which is the first card.
 */
export function clampBrowsingIndex(stored: number | undefined | null, total: number): number {
  if (stored === undefined || stored === null || !Number.isFinite(stored)) {
    return 0;
  }

  return Math.min(Math.max(Math.trunc(stored), 0), Math.max(total - 1, 0));
}
