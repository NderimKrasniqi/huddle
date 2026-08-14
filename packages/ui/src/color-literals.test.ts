import { describe, expect, it } from 'vitest';

import { colors } from '@huddle/design-tokens';

describe('neutral UI tokens', () => {
  it('keeps the shared renderer to white and black', () => {
    expect(Object.values(colors)).toEqual(['#FFFFFF', '#000000']);
  });
});
