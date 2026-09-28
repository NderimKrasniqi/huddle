import { describe, expect, it } from 'vitest';

import { fontFamilies, fontWeights, typography } from './typography';

describe('Heartbeat typography', () => {
  it('uses the three pinned Nunito face aliases', () => {
    expect(fontFamilies).toEqual({
      regular: 'Nunito_400Regular',
      bold: 'Nunito_700Bold',
      extraBold: 'Nunito_800ExtraBold',
    });
  });

  it('pairs every recipe with its real loaded face', () => {
    expect(typography.body).toMatchObject({
      fontFamily: fontFamilies.regular,
      fontWeight: fontWeights.regular,
    });
    expect(typography.caption).toMatchObject({
      fontFamily: fontFamilies.bold,
      fontWeight: fontWeights.bold,
    });

    for (const token of ['title', 'display', 'hero', 'tvDisplay'] as const) {
      expect(typography[token]).toMatchObject({
        fontFamily: fontFamilies.extraBold,
        fontWeight: fontWeights.extraBold,
      });
    }
  });
});
