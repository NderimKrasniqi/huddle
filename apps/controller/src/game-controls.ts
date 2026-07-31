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

/**
 * The meta under a browsed game's title on the Host's picker
 * (docs/design/design-handoff.md §7, "Selected-game card (mini key art + title
 * + meta)").
 *
 * It is the same three facts the §6 carousel draws as chips, read off
 * `GameMetadata` rather than written down here, so the phone and the television
 * describe one game and a new game teaches both at once by declaring its own
 * metadata. Only the *facts* are shared, though: the phrasing around them
 * (`<min>–<max> players`, `~<n> min`) is spelled out here and again in the TV's
 * chips, so rewording the summary is still two edits.
 */
export function browsedGameMeta(metadata: GameMetadata): string {
  const { playerRange, estimatedMinutes, category } = metadata;

  return [
    `${playerRange.min}–${playerRange.max} players`,
    `~${estimatedMinutes} min`,
    category,
  ].join(' · ');
}

/**
 * The caption under §8's status card — the handoff's own copy, and the whole
 * answer to "there is nothing to press here", which is what that screen looks
 * like. It says nothing about which game is up, so it is the same sentence on
 * every card and lives here rather than behind a game.
 */
export const NOW_VIEWING_CAPTION =
  'Your phone becomes the controller the moment the game starts';

/**
 * Which card a phone that is not running the room is watching
 * (docs/design/design-handoff.md §8) — the one half of that screen that does
 * depend on the game.
 */
export function nowViewingLine(metadata: GameMetadata): string {
  return `Now viewing ${metadata.title}`;
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

/**
 * What the Host's way out of a running game says (docs/CONTEXT.md, "Back to
 * lobby").
 *
 * One label on every beat, and it names where the room goes rather than what it
 * is leaving: the hub never reads a game's state, so this phone cannot know
 * whether the room is mid-question or looking at its final scores. "End game" is
 * false on the last of those — the game has already ended — where "Back to
 * lobby" is true on all of them.
 *
 * The second label is the tap in flight. A Host who cannot see that the first
 * one landed presses again, and while `endGame` is happy to be asked twice (see
 * `phaseAfter`), a button that looks untouched is a button that looks broken.
 */
export function backToLobbyLabel(returning: boolean): string {
  return returning ? 'Returning…' : 'Back to lobby';
}
