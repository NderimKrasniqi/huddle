/**
 * Voting owns this palette. The platform ends at the handoff; from there the
 * TV becomes a warm poster wall for the room's collective mood.
 */
export const votingTvTheme = {
  plum: brandColors.espresso,
  plumSoft: 'rgba(43, 31, 23, 0.72)',
  coral: brandColors.coral,
  coralDark: brandColors.coral,
  blush: brandColors.dustyRose,
  cream: brandColors.cream,
  butter: brandColors.butter,
  mint: brandColors.mint,
  sky: brandColors.sky,
  paperShadow: 'rgba(43, 31, 23, 0.18)',
  rule: 'rgba(43, 31, 23, 0.20)',
} as const;

export const votingOptionTones = [
  votingTvTheme.butter,
  votingTvTheme.blush,
  votingTvTheme.plum,
  votingTvTheme.mint,
] as const;
import { brandColors } from '@huddle/design-tokens';
