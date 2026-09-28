import { votingPalette } from './theme';

/**
 * Voting owns this palette. The platform ends at the handoff; from there the
 * TV becomes a warm poster wall for the room's collective mood.
 */
export const votingTvTheme = {
  plum: votingPalette.espresso,
  plumSoft: 'rgba(43, 31, 23, 0.72)',
  coral: votingPalette.coral,
  coralDark: votingPalette.coral,
  blush: votingPalette.dustyRose,
  cream: votingPalette.cream,
  butter: votingPalette.butter,
  mint: votingPalette.mint,
  sky: votingPalette.sky,
  paperShadow: 'rgba(43, 31, 23, 0.18)',
  rule: 'rgba(43, 31, 23, 0.20)',
} as const;

export const votingOptionTones = [
  votingTvTheme.butter,
  votingTvTheme.blush,
  votingTvTheme.plum,
  votingTvTheme.mint,
] as const;
