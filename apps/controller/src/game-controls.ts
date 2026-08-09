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

// `browsedGameMeta` was here: the same three facts joined into one line with
// middots, because the old picker drew them as a caption under a title. The
// approved board draws them as three chips on the card's own art, each with its
// own icon, so the card composes them itself and there is nothing left to join.

/**
 * The caption under §8's status card — the handoff's own copy, and the whole
 * answer to "there is nothing to press here", which is what that screen looks
 * like. It says nothing about which game is up, so it is the same sentence on
 * every card and lives here rather than behind a game.
 */
export const NOW_VIEWING_CAPTION = 'Your phone becomes the controller for the game on the TV.';

/**
 * The Host's way from their room to the picker (the approved board's "Choose a
 * game →").
 *
 * It navigates rather than starting anything, which is why it is the one
 * primary control in the product that carries an arrow: the room's other orange
 * buttons all commit something, and this one only changes what the Host is
 * looking at.
 */
export const CHOOSE_A_GAME = 'Choose a game';

/** The way back from the picker to the room, for the Host who changed their mind. */
export const BACK_TO_ROOM = 'Your room';

/**
 * Which card a phone that is not running the room is watching
 * (docs/design/design-handoff.md §8) — the one half of that screen that does
 * depend on the game.
 */
export function nowViewingLine(metadata: GameMetadata): string {
  return `Now viewing ${metadata.title}`;
}

/**
 * What a phone that is not running the room is waiting for (the approved
 * board's "Sam is choosing…").
 *
 * The Host's name and nothing about the game: the card they are on is already
 * on the chip below this line, and the television is showing it at the size the
 * room is actually reading it at.
 *
 * Falls back to naming nobody while the roster is in flight, rather than to a
 * blank or a placeholder name — the sentence is still true, and it is the same
 * shape, so nothing on the screen moves when the name lands.
 */
export function hostChoosingLine(hostNickname: string | undefined): string {
  return hostNickname === undefined ? 'Choosing a game…' : `${hostNickname} is choosing…`;
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

  // "Select <game>", not "Start <game>": the approved board's word, and the
  // right one now that this button lives on a picker the Host navigated to
  // rather than at the foot of the lobby. Choosing the card and committing the
  // room to it are the same tap either way — there is no screen between them.
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

  return { label: `Select ${game.title}`, enabled: true, blockedBecause: undefined };
}

/**
 * What the Host's way out of a running game says ("Back to lobby").
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

/**
 * What the Host's way out of the *room* says, and what it warns before doing it
 * (the scope's "end the room").
 *
 * Deliberately not a second "Back to lobby": that one returns a room to its
 * lobby with every seat intact, and this one deletes the room and every seat in
 * it. So the confirm names what is actually lost — the party has to rejoin from
 * a new code — rather than asking "are you sure?", which tells a Host nothing
 * they did not already know.
 *
 * The room is what ends here, not the app: the phone that tapped goes back to
 * the Join Screen along with everybody else's, because its own seat is gone too.
 */
export const END_ROOM = {
  label: 'End room',
  busyLabel: 'Ending…',
  title: 'End the room?',
  body: 'Everyone is sent back to the join screen and the room code stops working. This cannot be undone.',
  confirmLabel: 'End room',
} as const;
