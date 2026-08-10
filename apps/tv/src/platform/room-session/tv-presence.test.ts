import { afterEach, describe, expect, it, vi } from 'vitest';

import { keepTvPresent } from './tv-presence';

describe('TV presence', () => {
  afterEach(() => vi.useRealTimers());

  it('beats immediately, then on the interval, and stops cleanly', async () => {
    vi.useFakeTimers();
    const heartbeat = vi.fn(() => Promise.resolve());
    const stop = keepTvPresent(heartbeat, 3_000);
    expect(heartbeat).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(heartbeat).toHaveBeenCalledTimes(3);
    stop();
    await vi.advanceTimersByTimeAsync(6_000);
    expect(heartbeat).toHaveBeenCalledTimes(3);
  });

  it('does not queue heartbeats behind an unresolved network call', async () => {
    vi.useFakeTimers();
    let settle: (() => void) | undefined;
    const heartbeat = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        }),
    );

    keepTvPresent(heartbeat, 3_000);
    await vi.advanceTimersByTimeAsync(9_000);
    expect(heartbeat).toHaveBeenCalledTimes(1);

    settle?.();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(heartbeat).toHaveBeenCalledTimes(2);
  });
});
