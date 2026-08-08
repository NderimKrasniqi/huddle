import { huddleBaseTheme } from './base-theme';

/** TV shared-stage presentation defaults. */
export const huddleTvTheme = {
  ...huddleBaseTheme,
  typography: {
    display: { fontSize: 56, lineHeight: 64, fontWeight: '700' as const },
    heading: { fontSize: 40, lineHeight: 48, fontWeight: '700' as const },
    body: { fontSize: 22, lineHeight: 30, fontWeight: '400' as const },
    label: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
    caption: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  },
  layout: {
    safeMargin: 64,
    contentGap: 32,
    playerGap: 20,
    carouselGap: 28,
  },
  focus: {
    borderColor: '#FF6B4A',
    borderWidth: 3,
    scale: 1.04,
  },
} as const;

export type HuddleTvTheme = typeof huddleTvTheme;
