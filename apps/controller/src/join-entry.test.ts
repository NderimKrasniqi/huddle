import { NICKNAME_MAX_LENGTH, ROOM_CODE_LENGTH } from '@huddle/game-core';
import { describe, expect, it } from 'vitest';

import {
  activeCodeCell,
  canJoin,
  codeEntry,
  isCodeComplete,
  nicknameEntry,
} from './join-entry';

/**
 * What the code field holds after `keystrokes` are pressed one at a time, `<`
 * meaning backspace.
 *
 * This is exactly what the screen does: the field is controlled, so every
 * keystroke hands `codeEntry` the whole text the keyboard produced and takes
 * back the code the tiles show.
 */
function typeCode(keystrokes: string): string {
  let entry = '';
  for (const key of keystrokes) {
    entry = codeEntry(key === '<' ? entry.slice(0, -1) : entry + key);
  }
  return entry;
}

describe('code entry', () => {
  it('advances one cell per letter typed', () => {
    expect(activeCodeCell(typeCode(''))).toBe(0);
    expect(activeCodeCell(typeCode('K'))).toBe(1);
    expect(activeCodeCell(typeCode('KW'))).toBe(2);
    expect(activeCodeCell(typeCode('KWR'))).toBe(3);
  });

  it('fills the cells in the order the letters were typed', () => {
    expect(typeCode('KWRD')).toBe('KWRD');
  });

  it('has no active cell once the code is whole', () => {
    expect(activeCodeCell(typeCode('KWRD'))).toBeUndefined();
    expect(isCodeComplete(typeCode('KWRD'))).toBe(true);
    expect(isCodeComplete(typeCode('KWR'))).toBe(false);
  });

  it('walks back a cell per backspace, and stops at the first', () => {
    expect(typeCode('KWRD<')).toBe('KWR');
    expect(activeCodeCell(typeCode('KWRD<'))).toBe(3);
    expect(typeCode('KWRD<<<')).toBe('K');
    expect(typeCode('KWRD<<<<<<')).toBe('');
    expect(activeCodeCell(typeCode('KWRD<<<<<<'))).toBe(0);
  });

  it('upper-cases what is typed, because a Room Code is A–Z', () => {
    expect(typeCode('kwrd')).toBe('KWRD');
  });

  it('ignores keystrokes that are not letters of the alphabet', () => {
    expect(typeCode('K 1W-R!D')).toBe('KWRD');
    expect(typeCode('7')).toBe('');
  });

  it('takes an I, which a live room minted before the tvOS mitigation still holds', () => {
    expect(typeCode('RJBI')).toBe('RJBI');
    expect(codeEntry('rjbi')).toBe('RJBI');
  });

  it('takes no more letters than a Room Code has', () => {
    expect(typeCode('KWRDXYZ')).toBe('KWRD');
    expect(codeEntry('KWRDXYZ')).toHaveLength(ROOM_CODE_LENGTH);
  });

  it('accepts a whole code at once, as a scanned Join Link will hand it over', () => {
    expect(codeEntry('kwrd')).toBe('KWRD');
    expect(isCodeComplete(codeEntry(' kwrd '))).toBe(true);
  });
});

describe('nickname entry', () => {
  it('keeps what was typed', () => {
    expect(nicknameEntry('Grace Hopper')).toBe('Grace Hopper');
  });

  it('stops at the longest name the room will accept', () => {
    const tooLong = 'a'.repeat(NICKNAME_MAX_LENGTH + 5);

    expect(nicknameEntry(tooLong)).toBe('a'.repeat(NICKNAME_MAX_LENGTH));
  });

  it('counts a name the way the server does, in characters and not code units', () => {
    // Twenty astral characters are forty UTF-16 units; the server counts them
    // as twenty, so the field must not cut them at twenty either.
    const emoji = '🎉'.repeat(NICKNAME_MAX_LENGTH);

    expect(nicknameEntry(emoji)).toBe(emoji);
    expect(nicknameEntry(`${emoji}🎉`)).toBe(emoji);
  });
});

describe('canJoin', () => {
  it('waits for the whole code', () => {
    expect(canJoin('KWR', 'Ada')).toBe(false);
    expect(canJoin('KWRD', 'Ada')).toBe(true);
  });

  it('waits for a name with something in it', () => {
    expect(canJoin('KWRD', '')).toBe(false);
    expect(canJoin('KWRD', '   ')).toBe(false);
  });
});
