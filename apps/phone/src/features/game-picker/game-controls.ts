import type { GameMetadata, RosterSeatForGame } from '@huddle/domain';
import { carouselWindow } from '@huddle/game-registry';

/** The game the Host would start right now, given the card they are on. */
export function gameToStart(browsingAt: number): GameMetadata | undefined {
  const focused = carouselWindow(browsingAt)?.focused;
  return focused?.placeholder === true ? undefined : focused?.metadata;
}

export const NOW_VIEWING_CAPTION = 'Your phone becomes the phone for the game on the TV.';
export const CHOOSE_A_GAME = 'Choose a game';
export const BACK_TO_ROOM = 'Your room';

export function nowViewingLine(metadata: GameMetadata): string {
  return `Now viewing ${metadata.title}`;
}

export function hostChoosingLine(hostNickname: string | undefined): string {
  return hostNickname === undefined ? 'Choosing a game…' : `${hostNickname} is choosing…`;
}

export type StartControl = {
  readonly label: string;
  readonly enabled: boolean;
  readonly blockedBecause: string | undefined;
};

/**
 * Describes the Host's start action from the current roster and shared picker
 * position. The backend remains authoritative; this is a courteous local
 * preview while the roster subscription may be a round trip stale.
 */
export function startControl(
  seats: readonly RosterSeatForGame[],
  browsingAt: number,
): StartControl {
  const game = gameToStart(browsingAt);
  if (game === undefined) {
    const focused = carouselWindow(browsingAt)?.focused;
    return {
      label: focused?.placeholder === true ? 'Coming soon' : 'No games installed',
      enabled: false,
      blockedBecause:
        focused?.placeholder === true
          ? `${focused.metadata.title} is a reference placeholder and is not playable yet.`
          : undefined,
    };
  }

  const short = game.playerRange.min - seats.length;
  if (short > 0) {
    return {
      label: `Select ${game.title}`,
      enabled: false,
      blockedBecause:
        short === 1
          ? `${game.title} needs one more player.`
          : `${game.title} needs ${short} more players.`,
    };
  }

  const extra = seats.length - game.playerRange.max;
  if (extra > 0) {
    return {
      label: `Select ${game.title}`,
      enabled: false,
      blockedBecause:
        extra === 1
          ? `${game.title} supports up to ${game.playerRange.max} players. Remove one player to start.`
          : `${game.title} supports up to ${game.playerRange.max} players. Remove ${extra} players to start.`,
    };
  }

  return { label: `Select ${game.title}`, enabled: true, blockedBecause: undefined };
}
