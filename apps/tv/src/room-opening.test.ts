import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  keepOpeningRoom,
  type OpenRoom,
  reopenDelay,
  type RoomOpening,
  roomOpeningAtLaunch,
  roomOpeningCaption,
} from './room-opening';

/** The room `createRoom` hands back, as the TV receives it. */
const room: OpenRoom = { roomId: 'room-KWRD' as OpenRoom['roomId'], code: 'KWRD' };

/** A promise plus the handles to settle it, so an attempt can be held mid-flight. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('reopenDelay', () => {
  it('waits longer after each failed attempt', () => {
    expect([1, 2, 3, 4, 5].map(reopenDelay)).toEqual([1_000, 2_000, 4_000, 8_000, 16_000]);
  });

  it('settles into a steady retry rather than ever giving up', () => {
    // Nobody is going to touch the television, so the backoff has a ceiling and
    // no end: a TV left on through a router reboot has to come back by itself.
    expect([6, 7, 50, 5_000].map(reopenDelay)).toEqual([30_000, 30_000, 30_000, 30_000]);
    expect([1, 9, 999].map(reopenDelay).every(Number.isFinite)).toBe(true);
  });
});

describe('keepOpeningRoom', () => {
  let reported: RoomOpening[];
  const report = (opening: RoomOpening) => void reported.push(opening);

  /** Silences the deliberate failures below, and counts what they said. */
  const watchTheLog = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    reported = [];
    vi.useFakeTimers();
    watchTheLog();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens the room and hands it to the screen', async () => {
    const open = vi.fn(() => Promise.resolve(room));

    keepOpeningRoom(open, report);
    await vi.advanceTimersByTimeAsync(0);

    expect(open).toHaveBeenCalledTimes(1);
    expect(reported).toEqual([{ kind: 'open', room }]);
  });

  it('says it is reconnecting when the backend refuses, then tries again', async () => {
    const open = vi
      .fn<() => Promise<OpenRoom>>()
      .mockRejectedValueOnce(new Error('backend unreachable'))
      .mockResolvedValue(room);

    keepOpeningRoom(open, report);
    await vi.advanceTimersByTimeAsync(0);

    expect(reported).toEqual([{ kind: 'reconnecting' }]);

    // It waits out the backoff rather than hammering a backend that is down.
    await vi.advanceTimersByTimeAsync(reopenDelay(1) - 1);
    expect(open).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(open).toHaveBeenCalledTimes(2);
    expect(reported.at(-1)).toEqual({ kind: 'open', room });
  });

  it('lengthens the wait with each failure', async () => {
    const attemptedAfter: number[] = [];
    const start = Date.now();
    const open = vi.fn(() => {
      attemptedAfter.push(Date.now() - start);
      return attemptedAfter.length > 3 ? Promise.resolve(room) : Promise.reject(new Error('down'));
    });

    keepOpeningRoom(open, report);
    await vi.advanceTimersByTimeAsync(reopenDelay(1) + reopenDelay(2) + reopenDelay(3));

    expect(attemptedAfter).toEqual([0, 1_000, 3_000, 7_000]);
    expect(reported.at(-1)).toEqual({ kind: 'open', room });
  });

  it('keeps trying for as long as the television is on', async () => {
    // No human is going to press anything: giving up after n attempts would be
    // a pairing screen that stays broken until somebody finds the remote.
    let refusals = 0;
    const open = vi.fn(() =>
      (refusals += 1) > 200 ? Promise.resolve(room) : Promise.reject(new Error('down')),
    );

    keepOpeningRoom(open, report);
    await vi.advanceTimersByTimeAsync(201 * 30_000);

    expect(open).toHaveBeenCalledTimes(201);
    expect(reported.at(-1)).toEqual({ kind: 'open', room });
  });

  it('hands the screen the very same reconnecting state on every failure', async () => {
    // A fresh object each time would redraw the whole pairing screen twice a
    // minute for as long as the backend is away.
    const open = vi.fn(() => Promise.reject(new Error('down')));

    keepOpeningRoom(open, report);
    await vi.advanceTimersByTimeAsync(5 * 30_000);

    expect(reported.length).toBeGreaterThan(1);
    expect(reported.every((opening) => opening === reported[0])).toBe(true);
  });

  it('complains to the log once rather than once per attempt', async () => {
    // A television left on overnight against a backend that is gone would
    // otherwise write some 2,900 identical lines before anybody looked.
    const warn = watchTheLog();
    const open = vi.fn(() => Promise.reject(new Error('down')));

    keepOpeningRoom(open, report);
    await vi.advanceTimersByTimeAsync(5 * 30_000);

    expect(open.mock.calls.length).toBeGreaterThan(3);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('says it is reconnecting when the backend never answers, without asking twice', async () => {
    // The failure that actually happens: `ConvexReactClient` queues a mutation
    // it cannot send and neither resolves nor rejects it, so silence is what a
    // TV switched on ahead of its router gets. Re-issuing the queued mutation
    // would open a second room the moment the socket came up.
    const hung = deferred<OpenRoom>();
    const open = vi.fn(() => hung.promise);

    keepOpeningRoom(open, report);
    await vi.advanceTimersByTimeAsync(3_999);
    expect(reported).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    expect(reported).toEqual([{ kind: 'reconnecting' }]);

    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('opens the room when a hung attempt is finally answered', async () => {
    const hung = deferred<OpenRoom>();
    keepOpeningRoom(() => hung.promise, report);

    await vi.advanceTimersByTimeAsync(60_000);
    hung.resolve(room);
    await vi.advanceTimersByTimeAsync(0);

    expect(reported).toEqual([{ kind: 'reconnecting' }, { kind: 'open', room }]);
  });

  it('stops trying once the screen has gone away', async () => {
    const open = vi.fn(() => Promise.reject(new Error('down')));

    const stop = keepOpeningRoom(open, report);
    await vi.advanceTimersByTimeAsync(0);
    stop();
    await vi.advanceTimersByTimeAsync(5 * 30_000);

    expect(open).toHaveBeenCalledTimes(1);
  });

  it('says nothing to a screen that has gone away', async () => {
    const hung = deferred<OpenRoom>();

    const stop = keepOpeningRoom(() => hung.promise, report);
    stop();
    hung.resolve(room);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(reported).toEqual([]);
  });
});

describe('roomOpeningCaption', () => {
  it('invites the room to join while the room is opening and once it is open', () => {
    const invitation = { text: 'Open Huddle on your phone and enter this code', trouble: false };

    expect(roomOpeningCaption({ kind: 'opening' })).toEqual(invitation);
    expect(roomOpeningCaption({ kind: 'open', room })).toEqual(invitation);
  });

  it('says the TV is reconnecting, in the treatment that gets read across a room', () => {
    const caption = roomOpeningCaption({ kind: 'reconnecting' });

    expect(caption.text).toMatch(/reconnecting/i);
    expect(caption.trouble).toBe(true);
  });

  it('says all of it on one line of the TV stage', () => {
    // The caption sits in the code tiles' column, which shares the 1280px stage
    // with the QR card (252px) across a 96px gap — so the column has 932px, and
    // the chip spends 60 of them on its padding and ink border. At 22px Space
    // Grotesk, whose advance averages well under 0.6em, that is room for about
    // 66 characters; 64 leaves a margin. Arithmetic, not a measurement: there
    // is no simulator in this suite, and a caption that wrapped would push the
    // QR card sideways on the one screen nobody can touch.
    const captions = (
      [{ kind: 'opening' }, { kind: 'reconnecting' }, { kind: 'misconfigured' }] as const
    ).map((opening) => roomOpeningCaption(opening).text);

    expect(captions.map((text) => text.length <= 64)).toEqual([true, true, true]);
  });

  it('names the setting to fix when there is no deployment to open a room on', () => {
    // The only person who can act on this is whoever installed the app, and
    // what they need is the name of the variable, not an apology.
    const caption = roomOpeningCaption({ kind: 'misconfigured' });

    expect(caption.text).toContain('EXPO_PUBLIC_CONVEX_URL');
    expect(caption.trouble).toBe(true);
  });
});

describe('roomOpeningAtLaunch', () => {
  it('starts out trying when there is a deployment to try against', () => {
    expect(roomOpeningAtLaunch(true)).toEqual({ kind: 'opening' });
  });

  it('starts out saying so when there is not', () => {
    expect(roomOpeningAtLaunch(false)).toEqual({ kind: 'misconfigured' });
  });
});
