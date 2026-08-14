import { describe, expect, it } from 'vitest';

import { colors } from './colors';

describe('clean-slate colors', () => {
  it('contains exactly the neutral presentation values', () => {
    expect(colors).toEqual({ background: '#FFFFFF', text: '#000000' });
  });
});
