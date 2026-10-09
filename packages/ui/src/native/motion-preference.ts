import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * The device's reduce-motion setting. `undefined` until the device answers, so
 * each caller picks what an unknown preference means (most stay still). A
 * device that never answers, or fails to, counts as asking for less motion,
 * so nothing that waits on the answer can hang.
 */
export function useSystemReducedMotion(): boolean | undefined {
  const [reduce, setReduce] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    const fallback = setTimeout(() => {
      if (alive) setReduce((current) => current ?? true);
    }, 400);
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduce(value);
      })
      .catch(() => {
        if (alive) setReduce(true);
      });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      clearTimeout(fallback);
      subscription?.remove();
    };
  }, []);
  return reduce;
}

/**
 * Whole seconds left on the room's clock, counted down locally for display.
 * The room's deadline, not this, decides when time is up. `beat` names the
 * current step, so the count restarts when the step changes.
 */
export function useCountdownSeconds(clockRemainingMs: number | undefined, fallbackSeconds: number, beat: string): number {
  const fallbackMs = fallbackSeconds * 1000;
  const startingMs = Math.max(0, Number.isFinite(clockRemainingMs) ? clockRemainingMs! : fallbackMs);
  const initial = Math.ceil(startingMs / 1000);
  const [display, setDisplay] = useState({ beat, startingMs, seconds: initial });
  const seconds = display.beat === beat && display.startingMs === startingMs ? display.seconds : initial;
  useEffect(() => {
    if (startingMs <= 0) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const remaining = startingMs - (Date.now() - startedAt);
      setDisplay({ beat, startingMs, seconds: Math.max(0, Math.ceil(remaining / 1000)) });
      if (remaining <= 0) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [beat, startingMs]);
  return seconds;
}
