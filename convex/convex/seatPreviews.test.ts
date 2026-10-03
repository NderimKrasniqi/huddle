import { AVATAR_IDS, ROOM_PLAYER_CAP } from '@huddle/domain';
import { convexTest } from 'convex-test';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';
import { SEAT_PREVIEW_TTL_MS } from './seatPreviews';
import { roomFixture } from '../test/fixtures';

const modules = import.meta.glob(['./**/*.*s', '!./**/*.d.ts', '!./**/*.test.*']);
type Backend = ReturnType<typeof convexTest>;

const KEY_A = '123e4567-e89b-42d3-a456-426614174001';
const KEY_B = '123e4567-e89b-42d3-a456-426614174002';

async function roomWithTv(t: Backend) {
  const room = await roomFixture(t);
  const tvSessionToken = `tv-${room.code}`;
  await t.run(async (ctx) =>
    await ctx.db.insert('tvSessions', { roomId: room.roomId, sessionToken: tvSessionToken, lastSeenAt: Date.now(), away: false }),
  );
  return { ...room, tvSessionToken };
}

async function arrivalsOnTv(t: Backend, room: { roomId: Id<'rooms'>; tvSessionToken: string }) {
  const arriving = await t.query(api.seatPreviews.arrivals, { roomId: room.roomId, tvSessionToken: room.tvSessionToken });
  return arriving.map(({ nickname, avatar }) => ({ nickname, avatar }));
}

describe('seat previews', () => {
  afterEach(() => vi.useRealTimers());

  it('shows the join form on the TV as it changes, and to nobody else', async () => {
    const t = convexTest(schema, modules);
    const room = await roomWithTv(t);
    const seated = await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Ada', avatar: AVATAR_IDS[0] });

    await t.mutation(api.seatPreviews.previewSeat, { code: room.code, previewKey: KEY_A, nickname: 'Gr', avatar: AVATAR_IDS[1] });
    await t.mutation(api.seatPreviews.previewSeat, { code: room.code, previewKey: KEY_A, nickname: '  Grace ', avatar: AVATAR_IDS[2] });

    expect(await arrivalsOnTv(t, room)).toEqual([{ nickname: 'Grace', avatar: AVATAR_IDS[2] }]);
    expect(await t.query(api.seatPreviews.arrivals, { roomId: room.roomId, sessionToken: seated.sessionToken })).toEqual([]);
    expect(await t.query(api.seatPreviews.arrivals, { roomId: room.roomId })).toEqual([]);
  });

  it('drops a preview its phone stops refreshing, and keeps one it refreshes', async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const room = await roomWithTv(t);
    await t.mutation(api.seatPreviews.previewSeat, { code: room.code, previewKey: KEY_A, nickname: 'Kept', avatar: AVATAR_IDS[1] });
    await t.mutation(api.seatPreviews.previewSeat, { code: room.code, previewKey: KEY_B, nickname: 'Gone', avatar: AVATAR_IDS[2] });

    await vi.advanceTimersByTimeAsync(SEAT_PREVIEW_TTL_MS / 2);
    await t.mutation(api.seatPreviews.previewSeat, { code: room.code, previewKey: KEY_A, nickname: 'Kept', avatar: AVATAR_IDS[1] });
    await vi.advanceTimersByTimeAsync(SEAT_PREVIEW_TTL_MS / 2 + 1);
    await t.finishInProgressScheduledFunctions();

    expect(await arrivalsOnTv(t, room)).toEqual([{ nickname: 'Kept', avatar: AVATAR_IDS[1] }]);
  });

  it('leaves the TV once the phone clears it or joins with its avatar', async () => {
    const t = convexTest(schema, modules);
    const room = await roomWithTv(t);
    await t.mutation(api.seatPreviews.previewSeat, { code: room.code, previewKey: KEY_A, nickname: 'Lin', avatar: AVATAR_IDS[1] });
    await t.mutation(api.seatPreviews.previewSeat, { code: room.code, previewKey: KEY_B, nickname: 'Bo', avatar: AVATAR_IDS[2] });

    await t.mutation(api.seatPreviews.clearSeatPreview, { previewKey: KEY_A });
    await t.mutation(api.players.joinRoom, { code: room.code, nickname: 'Bo', avatar: AVATAR_IDS[2] });

    expect(await arrivalsOnTv(t, room)).toEqual([]);
  });

  it('never shows more arriving seats than the room has free', async () => {
    const t = convexTest(schema, modules);
    const room = await roomWithTv(t);
    for (let index = 0; index < ROOM_PLAYER_CAP - 1; index += 1) {
      await t.mutation(api.players.joinRoom, { code: room.code, nickname: `Player ${index}`, avatar: AVATAR_IDS[index]! });
    }

    await t.mutation(api.seatPreviews.previewSeat, { code: room.code, previewKey: KEY_A, nickname: 'Last', avatar: AVATAR_IDS[ROOM_PLAYER_CAP - 1]! });
    await t.mutation(api.seatPreviews.previewSeat, { code: room.code, previewKey: KEY_B, nickname: 'Extra', avatar: AVATAR_IDS[ROOM_PLAYER_CAP - 1]! });

    expect(await arrivalsOnTv(t, room)).toEqual([{ nickname: 'Last', avatar: AVATAR_IDS[ROOM_PLAYER_CAP - 1] }]);
  });

  it('does not count a preview the TV hides against the free seats', async () => {
    const t = convexTest(schema, modules);
    const room = await roomWithTv(t);
    for (let index = 0; index < ROOM_PLAYER_CAP - 1; index += 1) {
      await t.mutation(api.players.joinRoom, { code: room.code, nickname: `Player ${index}`, avatar: AVATAR_IDS[index]! });
    }

    // A form still sitting on an avatar someone holds is hidden, so it holds no seat.
    await t.mutation(api.seatPreviews.previewSeat, { code: room.code, previewKey: KEY_A, nickname: 'Late', avatar: AVATAR_IDS[0] });
    await t.mutation(api.seatPreviews.previewSeat, { code: room.code, previewKey: KEY_B, nickname: 'Next', avatar: AVATAR_IDS[ROOM_PLAYER_CAP - 1]! });

    expect(await arrivalsOnTv(t, room)).toEqual([{ nickname: 'Next', avatar: AVATAR_IDS[ROOM_PLAYER_CAP - 1] }]);
  });

  it('keeps one pending expiry per preview however often it refreshes', async () => {
    const t = convexTest(schema, modules);
    const room = await roomWithTv(t);
    for (const nickname of ['A', 'Ad', 'Ada']) {
      await t.mutation(api.seatPreviews.previewSeat, { code: room.code, previewKey: KEY_A, nickname, avatar: AVATAR_IDS[1] });
    }

    const pending = await t.run(async (ctx) =>
      (await ctx.db.system.query('_scheduled_functions').collect()).filter(
        (job) => job.name.includes('expireSeatPreview') && job.state.kind === 'pending',
      ),
    );
    expect(pending).toHaveLength(1);

    await t.mutation(api.seatPreviews.clearSeatPreview, { previewKey: KEY_A });
    const stillPending = await t.run(async (ctx) =>
      (await ctx.db.system.query('_scheduled_functions').collect()).filter(
        (job) => job.name.includes('expireSeatPreview') && job.state.kind === 'pending',
      ),
    );
    expect(stillPending).toHaveLength(0);
  });

  it('quietly ignores a code with no room and a malformed key', async () => {
    const t = convexTest(schema, modules);
    const room = await roomWithTv(t);

    await expect(
      t.mutation(api.seatPreviews.previewSeat, { code: 'ZZZZ', previewKey: KEY_A, nickname: 'Nope', avatar: AVATAR_IDS[1] }),
    ).resolves.toBeNull();
    await t.mutation(api.seatPreviews.previewSeat, { code: room.code, previewKey: 'not-a-key', nickname: 'Nope', avatar: AVATAR_IDS[1] });

    expect(await arrivalsOnTv(t, room)).toEqual([]);
  });
});
