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
 * (docs/design/legacy/boardwalk-handoff.md §8) — the one half of that screen that does
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
 * What a phone's way out of the room says (the scope's "leave").
 *
 * It replaced "End room", and the change is more than a word. End room was the
 * Host's alone and took every seat with it; leaving is everybody's and takes
 * exactly one — the reader's. So the confirm no longer warns about what is done
 * to other people, and what it says instead depends on who is leaving, which is
 * `leaveConsequence` below.
 *
 * Deliberately not a second "Back to lobby": that one ends a *game* and leaves
 * the room standing with every seat intact. This gives up a seat.
 */
export const LEAVE_ROOM = {
  label: 'Leave',
  busyLabel: 'Leaving…',
  title: 'Leave the room?',
  confirmLabel: 'Leave',
} as const;

/**
 * What leaving actually costs this phone, which is three different things.
 *
 * A confirm that said the same sentence to all three would be wrong twice. The
 * last player out closes the room — nobody is left to hold it, so the code stops
 * working; a Host with somebody still here hands it on rather than ending it;
 * and everybody else is simply giving up a seat they can retake. Each is worth
 * a second tap for a different reason, and only the first is irreversible.
 *
 * It does not have to ask whether there *is* a successor. `handOverRoom` hands
 * a leaver's room to the longest-connected remaining seat whether or not the
 * room is currently hearing from it — precisely so that "someone else takes
 * over" is a sentence the backend always keeps. The only room that ends up
 * without a host is one with nobody left in it, and that room is deleted.
 *
 * ## The stale-roster case, which is a false sentence and stays
 *
 * `joined` is the room as this phone last saw it, so it can be a round trip
 * behind — and it is `0` for as long as the roster query is in flight, during
 * which every phone including the Host draws the waiting screen. Opening the
 * sheet in that window tells a member of a six-person room that they are the
 * last one here.
 *
 * That is a false sentence and it is kept deliberately. Both directions have a
 * wrong case, and this is the one that errs toward not leaving: a player who is
 * told the room will close and hesitates has lost nothing, where a player told
 * they can rejoin a room that is about to close acts on it and cannot. The
 * window is a round trip wide, and the server does not read any of this — it
 * decides on rows, so the worst case is a stale sentence rather than a wrong
 * act.
 */
export function leaveConsequence(joined: number, youAreHost: boolean): string {
  if (joined <= 1) {
    return 'You’re the last one here, so the room closes and its code stops working.';
  }

  return youAreHost
    ? 'Someone else takes over the room. You can rejoin with the same code.'
    : 'You can rejoin with the same code while the room is open.';
}
