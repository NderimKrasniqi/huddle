/**
 * Soft Minimal's motion: the two animations the handoff pins a duration to
 * (docs/design/soft-minimal-handoff.md, "Interactions & Behavior"), plus the
 * platform feedback that carries Huddle through startup, recovery and pending
 * actions. The arithmetic below turns the avatar pop-in into something React
 * Native's spring understands.
 *
 * Durations live here for the same reason colors do — a number written at the
 * call site is a design decision nobody can find again — even though
 * `soft-minimal/tokens-only` does not police them: that rule keys on the property
 * names a style object uses, and a duration is an argument to an animation
 * rather than a style. The convention is the design system's; the lint rule
 * happens to cover only the part of it that lives in a stylesheet.
 *
 * Nothing here imports React Native, like everything else at this package's
 * root: these are numbers, and the components that animate with them are on the
 * far side of `@huddle/ui/native`.
 */

/**
 * How long each of Soft Minimal's animations runs. The first two are the
 * handoff's own approximate numbers ("~300ms", "~250ms"); the rest are the
 * shared platform timings for feedback the handoff did not specify.
 */
export const motionDuration = {
  /**
   * 300ms — "when a player joins, their card animates in (scale 0.6→1 with
   * slight overshoot, ~300ms spring)". A spring has no duration of its own, so
   * this is its natural period; see `springOf`.
   */
  popIn: 300,
  /**
   * 250ms — "TV animates card transition ~250ms ease-out", as the Host moves
   * the Browsing Game Index and the room's carousel follows.
   */
  cardTransition: 250,
  /** A restrained fade/scale when one platform-owned screen replaces another. */
  screenTransition: 220,
  /** One full breath of the Huddle mark on startup and recovery surfaces. */
  loadingPulse: 1_200,
  /** One complete three-dot activity cycle inside a pending control. */
  activityCycle: 900,
} as const;

/** The small amount of scale used by loading and screen-entry feedback. */
export const loadingMotion = {
  markFromScale: 0.96,
  markToScale: 1.04,
  markFromOpacity: 0.72,
  screenFromScale: 0.985,
} as const;

/**
 * The pop-in's shape, beside its duration above: where the scale starts and how
 * hard the spring rings on its way to 1.
 *
 * The handoff gives the first as a number ("scale 0.6→1") and the second in
 * words ("with slight overshoot"). 0.6 is a damping ratio that carries the
 * thing over 1 exactly once and by about 9% of the travel — visible as a spring
 * rather than as a bounce, which on a television at the size of a room is the
 * difference between news and a distraction.
 */
export const popIn = {
  fromScale: 0.6,
  dampingRatio: 0.6,
} as const;

/** A spring as React Native's `Animated.spring` takes it. */
export type SpringConfig = {
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
};

/**
 * The spring that rings once every `durationMs` at the damping ratio given.
 *
 * A spring is physics and not a timeline, so "~300ms spring" cannot be handed
 * to `Animated.spring` as a duration — that API takes stiffness, damping and
 * mass. This is the conversion, and it is the standard one for a second-order
 * system: with unit mass, a natural angular frequency ω = 2π/T gives a
 * stiffness of ω² and a damping of 2ζω. So the duration token names the
 * spring's *period* — the time it would take to complete one full oscillation
 * if nothing damped it — which is close enough to how long the motion takes to
 * be over that the handoff's "~" covers the difference: at ζ = 0.6 the
 * remaining wobble is under 3% of the travel by the time T is up.
 *
 * Seconds, not milliseconds, because that is the clock React Native's spring
 * integrates on (`SpringAnimation` steps by `deltaTime / 1000`); a stiffness
 * derived in milliseconds would be a million times too soft and read as no
 * animation at all.
 */
export function springOf(durationMs: number, dampingRatio: number): SpringConfig {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new RangeError(`spring duration must be a positive number of ms, got ${durationMs}`);
  }

  if (!Number.isFinite(dampingRatio) || dampingRatio <= 0 || dampingRatio > 1) {
    throw new RangeError(`damping ratio must be within (0, 1], got ${dampingRatio}`);
  }

  const mass = 1;
  const frequency = (2 * Math.PI) / (durationMs / 1_000);

  return {
    stiffness: frequency ** 2 * mass,
    damping: 2 * dampingRatio * frequency * mass,
    mass,
  };
}
