import { describe, expect, it } from 'vitest';

import { phoneNavigationAnimations } from './navigation-motion';

describe('Phone navigation motion', () => {
  it('stays static while unresolved and when Reduce Motion is enabled', () => {
    expect(phoneNavigationAnimations(undefined)).toEqual({ root: 'none', scan: 'none' });
    expect(phoneNavigationAnimations(true)).toEqual({ root: 'none', scan: 'none' });
  });

  it('uses the branded transitions only when motion is explicitly allowed', () => {
    expect(phoneNavigationAnimations(false)).toEqual({ root: 'fade', scan: 'slide_from_bottom' });
  });
});
