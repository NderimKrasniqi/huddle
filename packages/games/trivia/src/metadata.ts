import type { GameMetadata } from '@huddle/game-core';

/**
 * Trivia's metadata: the whole of its carousel card, and the client-safe half
 * of the game.
 *
 * It lives here, apart from `./logic`, because both sides need it and only one
 * side may have the questions. The server's `triviaGameLogic` and the clients'
 * `triviaGameModule` both point at this one object — `registry.test.ts` checks
 * that identity — so the card the TV draws and the game the room starts can
 * never name two different things. Nothing here reaches the Question Pack, which
 * is what lets the Controller draw the card without shipping the answers (5.9).
 */
export const triviaMetadata: GameMetadata = {
  id: 'trivia',
  title: 'Trivia',
  /**
   * Ink keeps Trivia distinct from the accent-filled Voting card. Its inverse
   * title also gives the across-the-room contrast the carousel requires.
   */
  keyArt: { color: 'ink' },
  /** The scope's "2–10 players", the second of which is a full room. */
  playerRange: { min: 2, max: 10 },
  /**
   * Ten questions — Phase 4's default count — at a 20-second countdown and a
   * five-second reveal apiece, plus the victory screen: about five minutes. The
   * handoff's "~12 min" chip is mock filler; the chip draws whatever the module
   * declares, and this is the number the scoped settings produce.
   */
  estimatedMinutes: 5,
  /** The genre chip. Not one of a Question Pack's categories. */
  category: 'Knowledge',
};
