/**
 * Bomb Squad's TV art, drawn in SVG and moved with React Native `Animated`.
 *
 * TV only: the phone app does not ship the native SVG module, so its Metro
 * config aliases `react-native-svg` to a stub that draws nothing. Nothing on
 * the phone renders these components.
 */
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

import { WIRE_COLOR } from './presentation';
import { bomb } from './theme';
import { type Wire, WIRES } from './types';

// Built on first use, not at import: the Node test suites load this module
// against a React Native stub that has no Animated.
let animatedParts: { readonly Path: typeof Path; readonly G: typeof G } | undefined;
function animated() {
  animatedParts ??= {
    Path: Animated.createAnimatedComponent(Path) as unknown as typeof Path,
    G: Animated.createAnimatedComponent(G) as unknown as typeof G,
  };
  return animatedParts;
}

/** The fuse as one curve; its drawn length is what burns down. */
const FUSE = 'M 300 118 C 310 40, 400 70, 430 20';
const FUSE_LENGTH = 190;

/** Points of a star, for the spark and the explosion. */
function starPoints(cx: number, cy: number, outer: number, inner: number, spikes: number): string {
  return Array.from({ length: spikes * 2 }, (_, i) => {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI * i) / spikes - Math.PI / 2;
    return `${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`;
  }).join(' ');
}

/** A value that loops 0 → 1 for as long as motion is allowed. */
function useLoop(duration: number, reduceMotion: boolean): Animated.Value {
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(Animated.timing(value, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [duration, reduceMotion, value]);
  return value;
}

/**
 * The bomb. `fuse` is how much fuse is left (1 → 0) and burns the rope down;
 * `urgency` (0 → 1) speeds up the shake and the spark.
 */
export function SvgBomb({
  size,
  fuse,
  urgency,
  cut,
  reduceMotion,
}: {
  readonly size: number;
  readonly fuse: number;
  readonly urgency: number;
  /** A wire already cut, drawn snapped. */
  readonly cut?: Wire | null;
  readonly reduceMotion: boolean;
}) {
  const step = Math.round(urgency * 4);
  const shake = useLoop(Math.max(90, 260 - step * 40), reduceMotion);
  const sparkSpin = useLoop(Math.max(240, 900 - step * 150), reduceMotion);
  const sway = useLoop(2600, reduceMotion);
  const [burn] = useState(() => new Animated.Value(fuse));
  useEffect(() => {
    Animated.timing(burn, { toValue: fuse, duration: reduceMotion ? 0 : 900, easing: Easing.linear, useNativeDriver: false }).start();
  }, [burn, fuse, reduceMotion]);

  const amplitude = 1 + step * 2.5;
  const translateX = shake.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, amplitude, 0, -amplitude, 0] });
  const rotate = shake.interpolate({ inputRange: [0, 0.25, 0.75, 1], outputRange: ['0deg', `${step * 0.6}deg`, `${-step * 0.6}deg`, '0deg'] });
  // The rope burns from its free end, so the spark rides the shrinking tip.
  const dashOffset = burn.interpolate({ inputRange: [0, 1], outputRange: [FUSE_LENGTH, 0] });
  const sparkScale = sparkSpin.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.85, 1.2, 0.85] });
  const sparkTurn = sparkSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  // Where the spark sits: interpolated along the curve's end points.
  const sparkLeft = burn.interpolate({ inputRange: [0, 0.35, 0.7, 1], outputRange: [300, 318, 370, 430] });
  const sparkTop = burn.interpolate({ inputRange: [0, 0.35, 0.7, 1], outputRange: [118, 62, 52, 20] });
  const scale = size / 600;
  const { Path: AnimatedPath, G: AnimatedG } = animated();

  return (
    <Animated.View
      style={{ width: size, height: size, transform: [{ translateX }, { rotate }] }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size} viewBox="0 0 600 600">
        <Defs>
          <RadialGradient id="body" cx="38%" cy="34%" r="70%">
            <Stop offset="0" stopColor={bomb.bodyLight} />
            <Stop offset="0.55" stopColor={bomb.panel} />
            <Stop offset="1" stopColor={bomb.night} />
          </RadialGradient>
          <RadialGradient id="gloss" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={bomb.cream} stopOpacity="0.55" />
            <Stop offset="1" stopColor={bomb.cream} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={bomb.hazard} stopOpacity="0.9" />
            <Stop offset="0.5" stopColor={bomb.spark} stopOpacity="0.45" />
            <Stop offset="1" stopColor={bomb.spark} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {/* Wires hanging below, swaying a little; the cut one hangs in two pieces. */}
        {WIRES.map((wire, index) => {
          const x = 210 + index * 60;
          const snapped = cut === wire;
          return (
            <AnimatedG
              key={wire}
              rotation={sway.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-3 + index, 3 - index, -3 + index] }) as unknown as number}
              origin={`${x}, 470`}
            >
              {snapped ? (
                <>
                  <Path d={`M ${x} 470 Q ${x - 6} 500 ${x - 2} 520`} stroke={WIRE_COLOR[wire]} strokeWidth={18} strokeLinecap="round" fill="none" />
                  <Path d={`M ${x + 6} 545 Q ${x + 14} 570 ${x + 4} 592`} stroke={WIRE_COLOR[wire]} strokeWidth={18} strokeLinecap="round" fill="none" />
                </>
              ) : (
                <Path d={`M ${x} 470 Q ${x + (index - 1.5) * 18} 530 ${x + (index - 1.5) * 34} 590`} stroke={WIRE_COLOR[wire]} strokeWidth={18} strokeLinecap="round" fill="none" />
              )}
            </AnimatedG>
          );
        })}
        <Ellipse cx="300" cy="545" rx="170" ry="22" fill={bomb.night} opacity={0.5} />
        <Circle cx="300" cy="330" r="190" fill="url(#body)" stroke={bomb.panelEdge} strokeWidth={6} />
        <Ellipse cx="225" cy="245" rx="70" ry="50" fill="url(#gloss)" />
        {/* The timer face. */}
        <Rect x="200" y="350" width="200" height="80" rx="40" fill={bomb.cream} />
        {[245, 300, 355].map((cx, index) => (
          <Circle key={cx} cx={cx} cy="390" r="15" fill={index === 2 ? bomb.spark : bomb.night} />
        ))}
        <Rect x="248" y="118" width="104" height="60" rx="18" fill={bomb.muted} />
        <Path d={FUSE} stroke={bomb.ropeBurnt} strokeWidth={16} strokeLinecap="round" fill="none" opacity={0.35} />
        <AnimatedPath d={FUSE} stroke={bomb.rope} strokeWidth={16} strokeLinecap="round" fill="none" strokeDasharray={`${FUSE_LENGTH} ${FUSE_LENGTH}`} strokeDashoffset={dashOffset as unknown as number} />
      </Svg>
      {/* The spark rides the tip of the fuse, spinning and glowing. */}
      <Animated.View
        style={[
          styles.spark,
          {
            width: 110 * scale,
            height: 110 * scale,
            left: Animated.subtract(Animated.multiply(sparkLeft, scale), 55 * scale),
            top: Animated.subtract(Animated.multiply(sparkTop, scale), 55 * scale),
            transform: [{ scale: sparkScale }, { rotate: sparkTurn }],
          },
        ]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 110 110">
          <Circle cx="55" cy="55" r="55" fill="url(#sparkGlow)" />
          <Defs>
            <RadialGradient id="sparkGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={bomb.hazard} stopOpacity="0.95" />
              <Stop offset="0.5" stopColor={bomb.spark} stopOpacity="0.5" />
              <Stop offset="1" stopColor={bomb.spark} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Polygon points={starPoints(55, 55, 34, 12, 8)} fill={bomb.cream} />
        </Svg>
      </Animated.View>
      <Embers size={size} burn={burn} reduceMotion={reduceMotion} />
    </Animated.View>
  );
}

/** Tiny embers that fly off the spark. */
function Embers({ size, burn, reduceMotion }: { readonly size: number; readonly burn: Animated.Value; readonly reduceMotion: boolean }) {
  const t = useLoop(900, reduceMotion);
  if (reduceMotion) return null;
  const scale = size / 600;
  const left = burn.interpolate({ inputRange: [0, 0.35, 0.7, 1], outputRange: [300, 318, 370, 430] });
  const top = burn.interpolate({ inputRange: [0, 0.35, 0.7, 1], outputRange: [118, 62, 52, 20] });
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i / 5) * Math.PI * 2 + 0.4;
        const drift = t.interpolate({ inputRange: [0, 1], outputRange: [0, 60 + i * 8] });
        return (
          <Animated.View
            key={i}
            style={[
              styles.ember,
              {
                width: 10 * scale + 4,
                height: 10 * scale + 4,
                left: Animated.add(Animated.multiply(left, scale), Animated.multiply(drift, Math.cos(angle) * scale)),
                top: Animated.add(Animated.multiply(top, scale), Animated.multiply(drift, Math.sin(angle) * scale)),
                opacity: t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.6, 0] }),
              },
            ]}
          />
        );
      })}
    </>
  );
}

/** The blast: a white flash, a starburst that blows outward, and smoke rings. */
export function SvgExplosion({ size, reduceMotion }: { readonly size: number; readonly reduceMotion: boolean }) {
  const [t] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(t, { toValue: 1, duration: 900, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true }).start();
  }, [reduceMotion, t]);
  const burst = t.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const flash = t.interpolate({ inputRange: [0, 0.15, 0.6], outputRange: [0, 0.9, 0], extrapolate: 'clamp' });
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: burst }] }]}>
        <Svg width={size} height={size} viewBox="0 0 600 600">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Circle key={i} cx={300 + Math.cos(i) * 170} cy={300 + Math.sin(i * 1.3) * 140} r={70 + (i % 3) * 18} fill={bomb.panelEdge} opacity={0.55} />
          ))}
          <Polygon points={starPoints(300, 300, 290, 150, 14)} fill={bomb.spark} />
          <Polygon points={starPoints(300, 300, 210, 110, 12)} fill={bomb.hazard} />
          <Polygon points={starPoints(300, 300, 120, 70, 10)} fill={bomb.cream} />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.flash, { opacity: flash }]} />
    </View>
  );
}

/** The defuse: a green ring that rings out from a calm bomb, with a check mark. */
export function SvgDefused({ size, reduceMotion }: { readonly size: number; readonly reduceMotion: boolean }) {
  const [t] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(t, { toValue: 1, duration: 700, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true }).start();
  }, [reduceMotion, t]);
  const ring = t.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.15] });
  const ringOpacity = t.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.9, 0.6, 0] });
  const check = t.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.6, 1.1, 1] });
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: ringOpacity, transform: [{ scale: ring }] }]}>
        <Svg width={size} height={size} viewBox="0 0 600 600">
          <Circle cx="300" cy="300" r="250" stroke={bomb.safe} strokeWidth={24} fill="none" />
        </Svg>
      </Animated.View>
      <Animated.View style={{ transform: [{ scale: check }] }}>
        <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 360 360">
          <Circle cx="180" cy="180" r="170" fill={bomb.safe} />
          <Path d="M 100 186 L 158 244 L 266 128" stroke={bomb.cream} strokeWidth={34} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Hazard stripes along an edge of the stage, scrolling slowly. */
export function HazardStripes({ width, height, reduceMotion }: { readonly width: number; readonly height: number; readonly reduceMotion: boolean }) {
  const t = useLoop(4000, reduceMotion);
  const shift = t.interpolate({ inputRange: [0, 1], outputRange: [0, -80] });
  const stripes = Math.ceil(width / 80) + 2;
  return (
    <View style={{ width, height, overflow: 'hidden' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={{ transform: [{ translateX: shift }] }}>
        <Svg width={width + 160} height={height}>
          <Rect width={width + 160} height={height} fill={bomb.hazard} />
          {Array.from({ length: stripes }, (_, i) => (
            <Polygon key={i} points={`${i * 80},0 ${i * 80 + 40},0 ${i * 80 + 40 - height},${height} ${i * 80 - height},${height}`} fill={bomb.night} />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  spark: { position: 'absolute' },
  ember: { position: 'absolute', borderRadius: 999, backgroundColor: bomb.hazard },
  flash: { ...StyleSheet.absoluteFill, backgroundColor: bomb.cream, borderRadius: 9999 },
});
