import { describe, expect, it } from 'vitest';

import {
  generateRoomCode,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type RandomSource,
} from './room-code';

/**
 * The draw that lands on a given letter. Aimed at the middle of the letter's
 * slice of [0, 1) so no floating-point rounding can push it into a neighbour.
 */
function drawFor(letter: string): number {
  return (ROOM_CODE_ALPHABET.indexOf(letter) + 0.5) / ROOM_CODE_ALPHABET.length;
}

/** A `RandomSource` that replays fixed draws, then fails loudly if asked for more. */
function draws(...values: readonly number[]): RandomSource {
  let next = 0;
  return () => {
    const value = values[next];
    if (value === undefined) {
      throw new Error(`Random source exhausted after ${values.length} draws`);
    }
    next += 1;
    return value;
  };
}

describe('generateRoomCode', () => {
  it('is four letters long', () => {
    expect(generateRoomCode()).toHaveLength(ROOM_CODE_LENGTH);
  });

  it('draws one letter per position, in order', () => {
    const source = draws(...[...'KWRD'].map(drawFor));

    expect(generateRoomCode(source)).toBe('KWRD');
  });

  it('spans the whole alphabet: the bottom of the range is A, the top is Z', () => {
    expect(generateRoomCode(draws(0, 0, 0, 0))).toBe('AAAA');
    expect(generateRoomCode(draws(...Array<number>(4).fill(0.999999)))).toBe('ZZZZ');
  });

  it('only ever produces A–Z', () => {
    const codes = Array.from({ length: 500 }, () => generateRoomCode());

    expect(codes.every((code) => /^[A-Z]{4}$/.test(code))).toBe(true);
  });
});
