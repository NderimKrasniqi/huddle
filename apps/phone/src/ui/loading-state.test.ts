import { describe, expect, it } from 'vitest';

import { phoneLoadingPresentation } from './loading-state';

describe('phone loading presentation', () => {
  it('distinguishes app startup from session recovery', () => {
    expect(phoneLoadingPresentation('startup')).not.toEqual(
      phoneLoadingPresentation('restoring'),
    );
  });

  it('makes session recovery explicit', () => {
    const state = phoneLoadingPresentation('restoring');
    expect(`${state.title} ${state.message}`).toMatch(/room|seat/i);
    expect(state.message).toMatch(/reconnect/i);
  });
});
