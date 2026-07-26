import { ROOM_CODE_ALPHABET } from '@huddle/game-core';
import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from './_generated/api';
import schema from './schema';
import type { RoomCodeExhausted } from './rooms';

// See schema.test.ts: pnpm's isolated node_modules layout defeats convex-test's
// default module lookup, so the function modules are handed over explicitly.
const modules = import.meta.glob(['./**/*.*s', '!./**/*.d.ts', '!./**/*.test.*']);

/**
 * The `Math.random()` draw that lands on a given letter, aimed at the middle of
 * the letter's slice of [0, 1) so no rounding can push it into a neighbour.
 */
function drawFor(letter: string): number {
  return (ROOM_CODE_ALPHABET.indexOf(letter) + 0.5) / ROOM_CODE_ALPHABET.length;
}

/**
 * Pins `Math.random()` so that `createRoom` draws exactly these codes, in this
 * order — the only way a uniqueness test proves anything: two real random draws
 * differ by luck, not by design.
 */
function pinDrawsTo(...codes: readonly string[]): void {
  const values = codes.flatMap((code) => [...code].map(drawFor));
  let next = 0;

  vi.spyOn(Math, 'random').mockImplementation(() => {
    const value = values[next];
    if (value === undefined) {
      throw new Error(`createRoom drew past the pinned codes [${codes.join(', ')}]`);
    }
    next += 1;
    return value;
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createRoom', () => {
  it('returns a room with a four-letter A–Z Room Code', async () => {
    const t = convexTest(schema, modules);

    const room = await t.mutation(api.rooms.createRoom, {});

    expect(room.code).toMatch(/^[A-Z]{4}$/);
    await t.run(async (ctx) => {
      expect(await ctx.db.get(room.roomId)).toMatchObject({ code: room.code });
    });
  });

  it('gives two rooms different codes', async () => {
    const t = convexTest(schema, modules);

    const first = await t.mutation(api.rooms.createRoom, {});
    const second = await t.mutation(api.rooms.createRoom, {});

    expect(second.code).not.toBe(first.code);
  });

  it('redraws when the drawn code is already held by a live room', async () => {
    const t = convexTest(schema, modules);
    // The second room draws KWRD again — the code its predecessor holds — and
    // must not settle for it.
    pinDrawsTo('KWRD', 'KWRD', 'ZEBU');

    const first = await t.mutation(api.rooms.createRoom, {});
    const second = await t.mutation(api.rooms.createRoom, {});

    expect(first.code).toBe('KWRD');
    expect(second.code).toBe('ZEBU');
  });

  it('fails rather than hand out a code a live room already holds', async () => {
    const t = convexTest(schema, modules);
    // Every draw collides with the first room's code. More codes are pinned
    // than `createRoom` may ever draw, so the run also proves the redraw loop
    // is bounded: an unbounded one exhausts the pin and fails on that instead.
    pinDrawsTo(...Array<string>(100).fill('KWRD'));

    await t.mutation(api.rooms.createRoom, {});
    const rejection: unknown = await t
      .mutation(api.rooms.createRoom, {})
      .then(() => undefined)
      .catch((error: unknown) => error);

    // Asserting the structured `data` rather than the message keeps the
    // bounded-throw/unbounded-spin distinction: an unbounded loop draws past
    // the pinned codes and rejects with the pin's plain Error, which carries no
    // `roomCodeExhausted` data and fails here.
    expect(rejection).toBeInstanceOf(ConvexError);
    expect((rejection as ConvexError<RoomCodeExhausted>).data).toEqual({
      kind: 'roomCodeExhausted',
      draws: expect.any(Number),
    });
  });
});
