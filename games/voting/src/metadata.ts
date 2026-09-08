import type { GameMetadata } from '@huddle/domain';

/** Client-safe Voting metadata shared by the rules and presentation entries. */
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
  /** Standard is five 30-second prompts plus shared reveals: about three minutes. */
  estimatedMinutes: 3,
  /** The genre chip. */
  category: 'Party',
};
