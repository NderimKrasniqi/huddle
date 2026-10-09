import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { bomb } from './theme';
import type { Clue, Wire } from './types';

export const WIRE_COLOR: Readonly<Record<Wire, string>> = {
  red: bomb.wireRed,
  blue: bomb.wireBlue,
  yellow: bomb.wireYellow,
  green: bomb.wireGreen,
};

export function wireName(wire: Wire): string {
  return wire.charAt(0).toUpperCase() + wire.slice(1);
}

/** A clue in words, as the phone shows it and a player would say it aloud. */
export function clueText(clue: Clue): string {
  switch (clue.kind) {
    case 'not':
      return `It's not ${clue.wire}.`;
    case 'tone':
      return clue.tone === 'warm' ? "It's a warm colour (red or yellow)." : "It's a cool colour (blue or green).";
    case 'side':
      return clue.side === 'left' ? "It's on the left half." : "It's on the right half.";
    case 'nextTo':
      return `It's right next to ${clue.wire}.`;
  }
}

/** Whether the device asks for less motion; true until it answers, to be safe. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => live && setReduced(value));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

/** A local display of the room's clock; the room still decides when time is up. */
export function useCountdownSeconds(clockRemainingMs: number | undefined, fallbackSeconds: number, beat: string): number {
  const startingMs = Math.max(0, Number.isFinite(clockRemainingMs) ? clockRemainingMs! : fallbackSeconds * 1000);
  const initial = Math.max(0, Math.ceil(startingMs / 1000));
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
