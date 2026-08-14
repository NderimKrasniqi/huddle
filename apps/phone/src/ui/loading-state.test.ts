import { describe, expect, it } from 'vitest';

import { phoneLoadingPresentation } from './loading-state';

describe('phone loading purposes', () => {
  it('maps startup and restoration to their exact labels', () => {
    expect(phoneLoadingPresentation('startup')).toEqual({ purpose: 'Starting Huddle' });
    expect(phoneLoadingPresentation('restoring')).toEqual({ purpose: 'Restoring your room' });
  });
});
