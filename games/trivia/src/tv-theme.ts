/**
 * Trivia owns this palette. It is deliberately not part of the Huddle
 * platform theme: the TV becomes a storybook quiz world after the host starts
 * the game.
 */
export const triviaTvTheme = {
  ink: brandColors.espresso,
  inkSoft: 'rgba(43, 31, 23, 0.68)',
  parchment: brandColors.cream,
  parchmentSoft: 'rgba(249, 241, 230, 0.94)',
  sage: brandColors.mint,
  moss: brandColors.mint,
  mossDark: brandColors.espresso,
  honey: brandColors.butter,
  coral: brandColors.coral,
  sky: brandColors.sky,
  rule: 'rgba(43, 31, 23, 0.20)',
  shadow: 'rgba(43, 31, 23, 0.18)',
} as const;

export const triviaOptionTones = [
  triviaTvTheme.sage,
  triviaTvTheme.honey,
  triviaTvTheme.coral,
  triviaTvTheme.sky,
] as const;
import { brandColors } from '@huddle/design-tokens';
