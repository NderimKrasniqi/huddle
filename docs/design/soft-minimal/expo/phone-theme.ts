import { huddleBaseTheme } from './base-theme';

/** Phone controller presentation defaults. */
export const huddlePhoneTheme = {
  ...huddleBaseTheme,
  typography: {
    title: { fontSize: 32, lineHeight: 40, fontWeight: '700' as const },
    heading: { fontSize: 24, lineHeight: 32, fontWeight: '700' as const },
    body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
    label: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
    caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
  },
  layout: {
    contentPadding: 24,
    controlMinHeight: 48,
    avatarPickerGap: 12,
    sectionGap: 24,
  },
} as const;

export type HuddlePhoneTheme = typeof huddlePhoneTheme;
