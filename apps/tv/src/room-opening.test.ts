import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  keepOpeningRoom,
  type OpenRoom,
  reopenDelay,
  roomOpener,
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
    const invitation = {
      kind: 'invitation',
      before: 'Open ',
      emphasis: 'Huddle',
      after: ' on your phone and enter the code',
    } as const;

    expect(roomOpeningCaption({ kind: 'opening' })).toEqual(invitation);
    expect(roomOpeningCaption({ kind: 'open', room })).toEqual(invitation);
  });

  it('says the TV is reconnecting, in the treatment that gets read across a room', () => {
    const caption = roomOpeningCaption({ kind: 'reconnecting' });

    expect(caption).toEqual({
      kind: 'trouble',
      text: expect.stringMatching(/reconnecting/i),
    });
  });

  it('says all of it on one line of the TV stage', () => {
    // The caption shares the hero row with the QR, so it must stay on one line.
    // Arithmetic, not a measurement: there is no simulator in this suite, and
    // a wrapped caption would push the QR card sideways.
    const captions = (
      [{ kind: 'opening' }, { kind: 'reconnecting' }, { kind: 'misconfigured' }] as const
    ).map((opening) => {
      const caption = roomOpeningCaption(opening);
      return caption.kind === 'invitation'
        ? `${caption.before}${caption.emphasis}${caption.after}`
        : caption.text;
    });

    expect(captions.map((text) => text.length <= 64)).toEqual([true, true, true]);
  });

  it('names the setting to fix when there is no deployment to open a room on', () => {
    // The only person who can act on this is whoever installed the app, and
    // what they need is the name of the variable, not an apology.
    const caption = roomOpeningCaption({ kind: 'misconfigured' });

    expect(caption).toEqual({
      kind: 'trouble',
      text: expect.stringContaining('EXPO_PUBLIC_CONVEX_URL'),
    });
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

describe('roomOpener', () => {
  /** A `createRoom` that mints a different room every time it is called. */
  function mintRooms() {
    let minted = 0;
    return vi.fn(() => {
      minted += 1;
      return Promise.resolve({
        roomId: `room-${minted}` as OpenRoom['roomId'],
        code: `ROO${minted}`,
      });
    });
  }

  it('opens one room however many callers ask for it', async () => {
    // What a StrictMode double-effect, a Fast Refresh and a remount all look
    // like: two rooms would strand every phone that read the first code.
    const mint = mintRooms();
    const { openRoom } = roomOpener(mint);

    const [first, second] = await Promise.all([openRoom(), openRoom()]);

    expect(first).toBe(second);
    expect(mint).toHaveBeenCalledTimes(1);
  });

  it('opens a fresh room once the one it was showing has expired', async () => {
    const mint = mintRooms();
    const { openRoom, closeExpiredRoom } = roomOpener(mint);
    const expired = await openRoom();

    closeExpiredRoom(expired);

    expect(await openRoom()).not.toEqual(expired);
    expect(mint).toHaveBeenCalledTimes(2);
  });

  it('has nothing to close before a room has opened', async () => {
    const mint = mintRooms();
    const { openRoom, closeExpiredRoom } = roomOpener(mint);

    closeExpiredRoom({ roomId: 'room-0' as OpenRoom['roomId'], code: 'KWRD' });

    expect(await openRoom()).toMatchObject({ code: 'ROO1' });
    expect(mint).toHaveBeenCalledTimes(1);
  });

  it('ignores an expiry reported twice while the replacement is still in flight', async () => {
    // The screen can say the same room has expired more than once — an effect
    // that runs twice, a second push of the same query. Forgetting the
    // replacement mid-flight would mint the second room the memo exists to
    // prevent, and the code on the screen would belong to neither of them.
    const mint = mintRooms();
    const { openRoom, closeExpiredRoom } = roomOpener(mint);
    const expired = await openRoom();

    closeExpiredRoom(expired);
    const replacing = openRoom();
    closeExpiredRoom(expired);

    expect(await replacing).toBe(await openRoom());
    expect(mint).toHaveBeenCalledTimes(2);
  });

  it('ignores an expiry reported for a room it is no longer showing', async () => {
    const mint = mintRooms();
    const { openRoom, closeExpiredRoom } = roomOpener(mint);
    const expired = await openRoom();
    closeExpiredRoom(expired);
    const replacement = await openRoom();

    closeExpiredRoom(expired);

    expect(await openRoom()).toBe(replacement);
    expect(mint).toHaveBeenCalledTimes(2);
  });
});
