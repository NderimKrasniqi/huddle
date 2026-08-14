/** The only UI colors in the clean-slate presentation. */
export const colors = {
  background: '#FFFFFF',
  text: '#000000',
} as const;

export type ColorToken = keyof typeof colors;
