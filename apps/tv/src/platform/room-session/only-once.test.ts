import { describe, expect, it, vi } from 'vitest';

import { onlyOnce } from './only-once';

/** A promise plus the handles to settle it, so a call can be held mid-flight. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('onlyOnce', () => {
  it('runs the operation on the first call only', async () => {
    const openBackendRoom = vi.fn(() => Promise.resolve({ code: 'KWRD' }));
    const openRoom = onlyOnce(openBackendRoom);

    await openRoom();
    await openRoom();
    await openRoom();

    expect(openBackendRoom).toHaveBeenCalledTimes(1);
  });

  it('gives every caller the same result', async () => {
    let rooms = 0;
    const openRoom = onlyOnce(() => Promise.resolve({ code: `ROOM${(rooms += 1)}` }));

    const [first, second] = await Promise.all([openRoom(), openRoom()]);

    expect(first).toBe(second);
    expect(rooms).toBe(1);
  });

  it('runs once even when callers pile up before the first call settles', async () => {
    // What a StrictMode double-effect looks like: the second call arrives while
    // the first mutation is still in flight.
    const room = deferred<{ code: string }>();
    const openBackendRoom = vi.fn(() => room.promise);
    const openRoom = onlyOnce(openBackendRoom);

    const attempts = [openRoom(), openRoom()];
    room.resolve({ code: 'KWRD' });

    expect(await Promise.all(attempts)).toEqual([{ code: 'KWRD' }, { code: 'KWRD' }]);
    expect(openBackendRoom).toHaveBeenCalledTimes(1);
  });

  it('lets the next caller retry after a failure', async () => {
    const openBackendRoom = vi
      .fn<() => Promise<{ code: string }>>()
      .mockRejectedValueOnce(new Error('backend unreachable'))
      .mockResolvedValueOnce({ code: 'KWRD' });
    const openRoom = onlyOnce(openBackendRoom);

    await expect(openRoom()).rejects.toThrow('backend unreachable');
    await expect(openRoom()).resolves.toEqual({ code: 'KWRD' });
    expect(openBackendRoom).toHaveBeenCalledTimes(2);
  });

  it('rejects a synchronous throw rather than throwing at the call site', async () => {
    const openRoom = onlyOnce<never>(() => {
      throw new Error('no client');
    });

    await expect(openRoom()).rejects.toThrow('no client');
  });
});
