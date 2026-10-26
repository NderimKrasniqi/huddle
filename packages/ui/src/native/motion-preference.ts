import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

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
