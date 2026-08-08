import { describe, expect, it } from 'vitest';

import { codeLetterBox } from './code-tile';

// These check what the token *declares*, which is all a constant can be checked
// for: that the letter's box comes from its tile rather than its glyph is a
// fact about native text layout, and the A/B in Phase 5's task is what
// establishes it. What these guard is the declaration quietly changing.
describe('codeLetterBox', () => {
  it('declares the stretch that overrides a tile\'s own alignItems', () => {
    expect(codeLetterBox.alignSelf).toBe('stretch');
  });

  it('declares the centring that a stretched box then needs', () => {
    expect(codeLetterBox.textAlign).toBe('center');
  });
});
