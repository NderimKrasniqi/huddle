import type { GameMetadata } from '@huddle/domain';

/**
 * Voting's metadata: its whole carousel card, held apart from `./logic`.
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
  title: 'Voting',
  /**
   * The accent sets the second poster apart from Trivia's ink. The two installed
   * games use the palette's two strong card fills; future games should bring
   * real key art instead of inventing more brand colors.
   */
  keyArt: { color: 'accent' },
  /** 2 up to the room's whole capacity (`ROOM_PLAYER_CAP`): a poll wants everyone at the table in it. */
  playerRange: { min: 2, max: 10 },
  /** Three prompts by default at 20 seconds and a short reveal apiece: about two minutes. */
  estimatedMinutes: 2,
  /** The genre chip. */
  category: 'Party',
};
