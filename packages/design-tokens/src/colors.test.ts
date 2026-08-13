import { describe, expect, it } from 'vitest';

import { colors } from './colors';

describe('Room semantic colors', () => {
  it('keeps Room surfaces warm without changing the shared palette', () => {
    expect(colors.roomSurface).toBe('#FDFAF9');
    expect(colors.surface).toBe('#FFFFFF');
    expect(colors.canvas).toBe('#FFF7F2');
  });

  it('provides semantic status treatments from the approved board', () => {
    expect(colors.roomCaption).toBe('#8A8E95');
    expect(colors.hostCrown).toBe('#F5A116');
    expect(colors.awayChipSurface).toBe('#EAF5FF');
    expect(colors.awayChipText).toBe('#2587C8');
  });
});
