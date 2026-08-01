/**
 * Boardwalk's motion: the two animations the handoff pins a duration to
 * (docs/design/design-handoff.md, "Interactions & Behavior") and the arithmetic
 * that turns one of them into something React Native's spring understands.
 *
 * Durations live here for the same reason colors do — a number written at the
 * call site is a design decision nobody can find again — even though
 * `boardwalk/tokens-only` does not police them: that rule keys on the property
 * names a style object uses, and a duration is an argument to an animation
 * rather than a style. The convention is the design system's; the lint rule
 * happens to cover only the part of it that lives in a stylesheet.
 *
 * Nothing here imports React Native, like everything else at this package's
 * root: these are numbers, and the components that animate with them are on the
 * far side of `@huddle/ui/native`.
 */

/**
 * How long each of Boardwalk's animations runs, per the handoff's own two
 * numbers. Both are approximate in the handoff ("~300ms", "~250ms") and exact
 * here, because a screen has to be given one number.
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
