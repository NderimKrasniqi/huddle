import { describe, expect, it } from 'vitest';

import { motionDuration, popIn, springOf } from './motion';

/** The damping ratio a spring config actually carries: ζ = c / (2√(km)). */
function dampingRatioOf({
  stiffness,
  damping,
  mass,
}: {
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
}): number {
  return damping / (2 * Math.sqrt(stiffness * mass));
}

/** The natural period a spring config actually carries, in milliseconds. */
function periodMsOf({
  stiffness,
  mass,
}: {
  readonly stiffness: number;
  readonly mass: number;
}): number {
  return (2 * Math.PI) / Math.sqrt(stiffness / mass) * 1_000;
}

describe('springOf', () => {
  it('turns a duration into a spring whose natural period is that duration', () => {
    // The whole point of the conversion: the handoff writes "~300ms spring",
    // React Native's spring takes stiffness and damping, and this is what
    // carries the one to the other. A spring that settled in twice the time
    // would still be a spring — and would not be the handoff's.
    expect(periodMsOf(springOf(300, 0.6))).toBeCloseTo(300, 6);
    expect(periodMsOf(springOf(250, 0.5))).toBeCloseTo(250, 6);
  });

  it('carries the damping ratio it was asked for', () => {
    // Soft Minimal's pop-in overshoots ("slight overshoot"), which is exactly what
    // a damping ratio under 1 means; the number has to survive the conversion
    // to stiffness/damping or the overshoot is whatever the arithmetic left.
    expect(dampingRatioOf(springOf(300, 0.6))).toBeCloseTo(0.6, 12);
    expect(dampingRatioOf(springOf(300, 1))).toBeCloseTo(1, 12);
  });

  it('gives every spring unit mass, so stiffness and damping read as the physics', () => {
    expect(springOf(300, 0.6).mass).toBe(1);
  });

  it('rejects a duration no spring could run in', () => {
    expect(() => springOf(0, 0.6)).toThrow(RangeError);
    expect(() => springOf(-300, 0.6)).toThrow(RangeError);
    expect(() => springOf(Number.NaN, 0.6)).toThrow(RangeError);
  });

  it('rejects a damping ratio outside a real spring', () => {
    // 0 is a spring that never stops ringing and >1 is one that cannot reach
    // its target in the time asked for; both are a caller's mistake rather than
    // a design decision, so they fail here instead of on a television.
    expect(() => springOf(300, 0)).toThrow(RangeError);
    expect(() => springOf(300, -0.5)).toThrow(RangeError);
    expect(() => springOf(300, 1.5)).toThrow(RangeError);
  });
});

describe('the pop-in', () => {
  it('grows into place rather than shrinking', () => {
    // The handoff: "scale 0.6→1". A `fromScale` at or above 1 would be a
    // different animation wearing the same name.
    expect(popIn.fromScale).toBeGreaterThan(0);
    expect(popIn.fromScale).toBeLessThan(1);
  });

  it('overshoots slightly rather than easing flat into place', () => {
    // Underdamped, which is what makes it a spring and not a fade. Critically
    // damped (1) would satisfy "300ms" and lose "with slight overshoot".
    expect(popIn.dampingRatio).toBeGreaterThan(0);
    expect(popIn.dampingRatio).toBeLessThan(1);
    // Past 1 exactly once and by a hand's width, not a bounce: the standard
    // peak overshoot e^(-πζ/√(1-ζ²)) stays inside a tenth of the travel.
    const overshoot = Math.exp(
      (-Math.PI * popIn.dampingRatio) / Math.sqrt(1 - popIn.dampingRatio ** 2),
    );
    expect(overshoot).toBeLessThan(0.1);
    expect(overshoot).toBeGreaterThan(0.02);
  });
});

describe('motionDuration', () => {
  it('holds the handoff’s two durations, and they are not the same number', () => {
    // A card transition that took as long as a pop-in would be one token doing
    // two jobs — which is how one of them ends up changed by an edit meant for
    // the other, the same reason `stickerTilt` names a surface per entry.
    expect(motionDuration.popIn).not.toBe(motionDuration.cardTransition);
    expect(motionDuration.popIn).toBeGreaterThan(0);
    expect(motionDuration.cardTransition).toBeGreaterThan(0);
  });
});
