import { describe, expect, it } from 'vitest';

import {
  generateRoomCode,
  ROOM_CODE_ACCEPTED_ALPHABET,
  ROOM_CODE_MINT_ALPHABET,
  ROOM_CODE_LENGTH,
  type RandomSource,
} from './room-code';

/**
 * The draw that lands on a given letter. Aimed at the middle of the letter's
 * slice of [0, 1) so no floating-point rounding can push it into a neighbour.
 *
 * A letter the alphabet does not hold is a test asking for a code the generator
 * cannot produce, so it fails here rather than quietly drawing something else.
 */
function drawFor(letter: string): number {
  const index = ROOM_CODE_MINT_ALPHABET.indexOf(letter);
  if (index < 0) {
    throw new Error(`No draw lands on "${letter}": ROOM_CODE_MINT_ALPHABET does not hold it`);
  }
  return (index + 0.5) / ROOM_CODE_MINT_ALPHABET.length;
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

  it('only ever produces letters of the alphabet', () => {
    const codes = Array.from({ length: 500 }, () => generateRoomCode());

    expect(
      codes.every((code) => [...code].every((letter) => ROOM_CODE_MINT_ALPHABET.includes(letter))),
    ).toBe(true);
  });

  it('can never draw an I, the letter a tvOS Room Code tile drops', () => {
    // Every draw the generator can make, one per slice of [0, 1): what comes
    // back is the whole of what a Room Code can ever be spelled with.
    const everyLetter = new Set(
      Array.from({ length: ROOM_CODE_MINT_ALPHABET.length }, (_unused, index) => {
        const draw = (index + 0.5) / ROOM_CODE_MINT_ALPHABET.length;
        return generateRoomCode(draws(...Array<number>(ROOM_CODE_LENGTH).fill(draw)));
      }).flatMap((code) => [...code]),
    );

    expect(everyLetter).toEqual(new Set(ROOM_CODE_MINT_ALPHABET));
    expect(everyLetter.has('I')).toBe(false);
  });
});

describe('the alphabets', () => {
  it('mints every letter but I', () => {
    const notMinted = [...ROOM_CODE_ACCEPTED_ALPHABET].filter(
      (letter) => !ROOM_CODE_MINT_ALPHABET.includes(letter),
    );

    expect(notMinted).toEqual(['I']);
  });

  it('still accepts an I, because rooms minted before the mitigation hold one', () => {
    expect(ROOM_CODE_ACCEPTED_ALPHABET).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  });
});
