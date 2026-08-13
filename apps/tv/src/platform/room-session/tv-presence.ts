import { HEARTBEAT_INTERVAL_MS } from '@huddle/domain';

/** A small injectable loop so TV presence is deterministic in tests. */
export function keepTvPresent(
  heartbeat: () => Promise<void>,
  intervalMs: number = HEARTBEAT_INTERVAL_MS,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let heartbeatPending = false;

  const beat = () => {
    if (stopped || heartbeatPending) return;
    heartbeatPending = true;
    void heartbeat()
      .catch(() => {
        // Convex reconnects and the next beat retries. Presence is advisory; a
        // transient network failure must not tear down the TV display.
      })
      .finally(() => {
        heartbeatPending = false;
      });
  };
  beat();
  timer = setInterval(beat, intervalMs);
  return () => {
    stopped = true;
    if (timer !== undefined) clearInterval(timer);
  };
}
