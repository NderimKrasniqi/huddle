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
   * The accent — the second poster on the carousel, set apart from trivia's
   * ink. Boardwalk had five accents to spread across the cards and Soft Minimal
   * has one, so the two installed games take the only two fills the palette
   * offers a card: navy and orange. A third game is the point at which that
   * stops working, and the answer then is the real key art the design package
   * calls for rather than a sixth colour invented here.
   */
  keyArt: { color: 'accent' },
  /** 2 up to the room's whole capacity (`ROOM_PLAYER_CAP`): a poll wants everyone at the table in it. */
  playerRange: { min: 2, max: 10 },
  /** Three prompts by default at 20 seconds and a short reveal apiece: about two minutes. */
  estimatedMinutes: 2,
  /** The genre chip. */
  category: 'Party',
};
