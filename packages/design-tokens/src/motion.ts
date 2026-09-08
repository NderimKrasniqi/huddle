/** Millisecond durations for standard motion. */
export const durations = {
  instant: 0,
  fast: 160,
  standard: 240,
  slow: 420,
  celebration: 700,
} as const;

/** Reduced-motion values keep state changes immediate without removing them. */
export const reducedMotionDurations = {
  instant: 0,
  fast: 0,
  standard: 0,
  slow: 0,
  celebration: 0,
} as const;

export const motionDurations = {
  instant: { normal: durations.instant, reduced: reducedMotionDurations.instant },
  fast: { normal: durations.fast, reduced: reducedMotionDurations.fast },
  standard: { normal: durations.standard, reduced: reducedMotionDurations.standard },
  slow: { normal: durations.slow, reduced: reducedMotionDurations.slow },
  celebration: {
    normal: durations.celebration,
    reduced: reducedMotionDurations.celebration,
  },
} as const;

export type DurationToken = keyof typeof durations;

/** Resolve a token for the user's current reduced-motion preference. */
export function durationFor(token: DurationToken, reduceMotion: boolean): number {
  return reduceMotion ? reducedMotionDurations[token] : durations[token];
}
