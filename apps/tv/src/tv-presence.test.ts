import { describe, expect, it, vi } from 'vitest';

import { keepTvPresent } from './tv-presence';

describe('TV presence', () => {
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
    vi.useRealTimers();
  });
});
