import { HEARTBEAT_INTERVAL_MS } from '@huddle/domain';

export type TokenSource = { readonly read: () => Promise<string | null> };

export type Heartbeat = (sessionToken: string) => Promise<unknown>;

export type ForegroundWatch = (onChange: (inForeground: boolean) => void) => () => void;

export function keepPresent(
  store: TokenSource,
  beat: Heartbeat,
  watchForeground: ForegroundWatch,
  interval: number = HEARTBEAT_INTERVAL_MS,
): () => void {
  let sessionToken: string | null = null;
  let inForeground = false;
  let beating: ReturnType<typeof setInterval> | undefined;
  let pulsePending = false;
  let stopped = false;

  async function pulse(token: string): Promise<void> {
    pulsePending = true;
    try {
      await beat(token);
    } catch {
    } finally {
      pulsePending = false;
    }
  }

  function beatNow(): void {
    if (sessionToken !== null && !pulsePending) {
      void pulse(sessionToken);
    }
  }

  function startBeating(): void {
    if (beating !== undefined || stopped || !inForeground || sessionToken === null) {
      return;
    }

    beatNow();
    beating = setInterval(beatNow, interval);
  }

  function stopBeating(): void {
    if (beating !== undefined) {
      clearInterval(beating);
      beating = undefined;
    }
  }

  const unwatch = watchForeground((foreground) => {
    inForeground = foreground;

    if (foreground) {
      startBeating();
    } else {
      stopBeating();
    }
  });

  void store.read().then(
    (remembered) => {
      sessionToken = remembered;
      startBeating();
    },
    () => {
    },
  );

  return () => {
    stopped = true;
    stopBeating();
    unwatch();
  };
}
