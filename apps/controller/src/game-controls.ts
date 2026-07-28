import type { GameMetadata, RosterSeatForGame } from '@huddle/game-core';
import { carouselWindow } from '@huddle/game-registry';

/**
 * What the Host's phone offers in the lobby, and what it says when it cannot
 * offer it.
 *
 * What it starts is whatever card the room is browsing (handoff §7), so the
 * arrows and this button are two views of the same `browsingGameIndex` — and a
 * Host who never touches the arrows starts the first card, which with one game
 * installed is the only one.
 */

/** The game the Host would start right now, given the card they are on. */
export function gameToStart(browsingAt: number): GameMetadata | undefined {
  return carouselWindow(browsingAt)?.focused.metadata;
}

/** What the Host's start control says and whether it can be pressed. */
export type StartControl = {
  readonly label: string;
  readonly enabled: boolean;
  /** Why it cannot be pressed, for the line under it. `undefined` when it can. */
  readonly blockedBecause: string | undefined;
};

/**
 * The Host's "start" control, given who is in the room.
 *
 * The player count is checked here as well as in `startGame` deliberately, and
 * they are not the same check doing the same job: the server's is the rule, and
 * this is the courtesy — a button that says what it is waiting for beats one
 * that refuses after it is pressed. The server stays the thing that decides,
 * because this phone's roster is a subscription and can be a round trip stale.
 */
export function startControl(
  seats: readonly RosterSeatForGame[],
  browsingAt: number,
): StartControl {
  const game = gameToStart(browsingAt);

  if (game === undefined) {
    // No games installed. Unreachable while the Registry has an entry, and the
    // honest answer rather than a button that starts nothing.
    return { label: 'No games installed', enabled: false, blockedBecause: undefined };
  }

  const short = game.playerRange.min - seats.length;

  if (short > 0) {
    return {
      label: `Start ${game.title}`,
      enabled: false,
      blockedBecause:
        short === 1
          ? `${game.title} needs one more player.`
          : `${game.title} needs ${short} more players.`,
    };
  }

  return { label: `Start ${game.title}`, enabled: true, blockedBecause: undefined };
}
