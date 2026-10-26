import { HEARTBEAT_INTERVAL_MS } from '@huddle/domain';

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
