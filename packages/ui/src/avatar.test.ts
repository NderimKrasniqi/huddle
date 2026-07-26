import { describe, expect, it } from 'vitest';

import { playerInitials } from './avatar';

describe('playerInitials', () => {
  it('takes the first letter of a one-word nickname', () => {
    expect(playerInitials('Nderim')).toBe('N');
  });

  it('takes two letters from two words, and no more from more', () => {
    expect(playerInitials('Grace Hopper')).toBe('GH');
    expect(playerInitials('Ada Byron King Lovelace')).toBe('AB');
  });

  it('upper-cases, the way Bungee is always set', () => {
    expect(playerInitials('ada')).toBe('A');
  });

  it('ignores the spacing around and between words', () => {
    expect(playerInitials('  grace   hopper ')).toBe('GH');
  });

  it('gives a blank monogram rather than failing on a nickname of nothing', () => {
    expect(playerInitials('')).toBe('');
    expect(playerInitials('   ')).toBe('');
  });

  it('keeps a leading character whole when it is outside the basic plane', () => {
    expect(playerInitials('🎲 dice')).toBe('🎲D');
  });
});
