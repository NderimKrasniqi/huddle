import type { GameMetadata } from '@huddle/game-core';

/**
 * Hot Takes' metadata: its whole carousel card, held apart from `./logic`.
 *
 * The same seam trivia draws (`./metadata` beside `./logic`), kept even though
 * this game has no secret to protect: its prompts are opinion, not answers, so
 * nothing here would leak. The point is that a game is one shape — the server's
 * `votingGameLogic` and the clients' `votingGameModule` both point at this one
 * object, so the card and the game name one thing, and `registry.test.ts` checks
 * that identity the same way for both games.
 */
export const votingMetadata: GameMetadata = {
  id: 'voting',
  title: 'Hot Takes',
  /**
   * Tangerine — the second poster on the carousel, set apart from trivia's
   * punch. The colors are all Boardwalk accents (`KEY_ART_COLOR_NAMES`); which
   * of the five each card wears is a design-fidelity call (task 5.2), and this
   * gives the party game a face of its own until that pass settles it.
   */
  keyArt: { color: 'tangerine' },
  /** 2 up to the room's whole capacity (`ROOM_PLAYER_CAP`): a poll wants everyone at the table in it. */
  playerRange: { min: 2, max: 10 },
  /** Three prompts by default at 20 seconds and a short reveal apiece: about two minutes. */
  estimatedMinutes: 2,
  /** The genre chip. */
  category: 'Party',
};
