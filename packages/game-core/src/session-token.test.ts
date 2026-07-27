import { describe, expect, it } from 'vitest';

import type { RandomSource } from './room-code';
import {
  generateSessionToken,
  SESSION_TOKEN_ALPHABET,
  SESSION_TOKEN_LENGTH,
} from './session-token';

/**
 * The draw that lands on a given character. Aimed at the middle of that
 * character's slice of [0, 1) so no floating-point rounding can push it into a
 * neighbour.
 */
function drawFor(character: string): number {
  return (SESSION_TOKEN_ALPHABET.indexOf(character) + 0.5) / SESSION_TOKEN_ALPHABET.length;
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

describe('generateSessionToken', () => {
  it('draws one character per position, in order', () => {
    const token = 'huddle01'.padEnd(SESSION_TOKEN_LENGTH, 'z');

    expect(generateSessionToken(draws(...[...token].map(drawFor)))).toBe(token);
  });

  it('spans the whole alphabet: the bottom of the range is a, the top is 9', () => {
    const everyDraw = (value: number) => draws(...Array<number>(SESSION_TOKEN_LENGTH).fill(value));

    expect(generateSessionToken(everyDraw(0))).toBe('a'.repeat(SESSION_TOKEN_LENGTH));
    expect(generateSessionToken(everyDraw(0.999999))).toBe('9'.repeat(SESSION_TOKEN_LENGTH));
  });

  it('only ever produces characters of its own alphabet', () => {
    const tokens = Array.from({ length: 500 }, () => generateSessionToken());

    expect(tokens.every((token) => /^[a-z0-9]{24}$/.test(token))).toBe(true);
  });

  it('is long enough that a token is nobody else’s', () => {
    // The whole rejoin design rests on this: a token is the only thing standing
    // between a phone and a seat, and nothing checks it against the tokens
    // already minted. 500 draws colliding even once would say the length or the
    // randomness is wrong.
    const tokens = Array.from({ length: 500 }, () => generateSessionToken());

    expect(new Set(tokens).size).toBe(tokens.length);
  });
});
