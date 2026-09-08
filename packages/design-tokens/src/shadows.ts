import { brandColors } from './colors';

/** A React Native-compatible shadow recipe. */
export type ShadowRecipe = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

/**
 * Use these recipes for tangible depth while retaining a soft, warm board
 * feel.  They intentionally avoid web-only box-shadow syntax.
 */
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  card: {
    shadowColor: brandColors.espresso,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  raised: {
    shadowColor: brandColors.espresso,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  floating: {
    shadowColor: brandColors.espresso,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 10,
  },
} as const satisfies Record<string, ShadowRecipe>;

export type ShadowToken = keyof typeof shadows;
