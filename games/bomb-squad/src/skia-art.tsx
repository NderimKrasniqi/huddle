/**
 * Bomb Squad's TV art, drawn with Skia (GPU gradients, blur and shadows) and
 * moved with React Native `Animated`: games may not use Reanimated, so each
 * moving part is its own small canvas inside an animated view.
 *
 * TV only: the phone app does not ship Skia, so its Metro config aliases
 * `@shopify/react-native-skia` to a stub that draws nothing.
 */
import {
  BlurMask,
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  LinearGradient,
  Oval,
  Path,
  RadialGradient,
  Rect,
  RoundedRect,
  Shadow,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { WIRE_COLOR } from './presentation';
import { bomb } from './theme';
import { WIRES } from './types';

/** A value that loops 0 → 1 for as long as motion is allowed. */
function useLoop(duration: number, reduceMotion: boolean): Animated.Value {
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(Animated.timing(value, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [duration, reduceMotion, value]);
  return value;
}

/** A star as a Skia path, for sparks and blasts. */
function starPath(cx: number, cy: number, outer: number, inner: number, spikes: number) {
  const path = Skia.Path.Make();
  for (let i = 0; i < spikes * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI * i) / spikes - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.close();
  return path;
}

/** The fuse rope, from the cap up to its free end; trimmed as it burns. */
const FUSE = Skia.Path.MakeFromSVGString('M 300 132 C 304 70, 360 60, 400 54 S 452 22, 448 -4')!;

/**
 * The bomb. `fuse` is how much rope is left (1 → 0); `urgency` (0 → 1) speeds
 * up the shake and the spark. Drawn on a 600×600 board, scaled to `size`.
 */
export function SkiaBomb({
  size,
  fuse,
  urgency,
  reduceMotion,
}: {
  readonly size: number;
  readonly fuse: number;
  readonly urgency: number;
  readonly reduceMotion: boolean;
}) {
  const step = Math.round(urgency * 4);
  const shake = useLoop(Math.max(90, 280 - step * 45), reduceMotion);
  const flicker = useLoop(Math.max(220, 700 - step * 110), reduceMotion);
  const amplitude = (1 + step * 2.4) * (size / 600);
  const translateX = shake.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, amplitude, 0, -amplitude, 0] });
  const rotate = shake.interpolate({ inputRange: [0, 0.25, 0.75, 1], outputRange: ['0deg', `${step * 0.7}deg`, `${-step * 0.7}deg`, '0deg'] });
  const sparkScale = flicker.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 1.25, 0.8] });
  const sparkTurn = flicker.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '120deg'] });
  const scale = size / 600;
  const left = Math.max(0, Math.min(1, fuse));
  // Where the burning tip sits on the rope.
  const tip = useMemo(() => FUSE.getPoint(FUSE.countPoints() - 1), []);
  const tipAt = left >= 0.999 ? tip : pointAlong(left);
  const wires = useMemo(() => wirePaths(), []);

  return (
    <Animated.View
      style={{ width: size, height: size, transform: [{ translateX }, { rotate }] }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Canvas style={{ width: size, height: size }}>
        <Group transform={[{ scale }]}>
          {/* Soft floor shadow. */}
          <Oval x={140} y={520} width={320} height={50} color={bomb.night} opacity={0.75}>
            <BlurMask blur={18} style="normal" />
          </Oval>
          {/* Wires, each with a little sheen. */}
          {wires.map(({ wire, path }) => (
            <Group key={wire}>
              <Path path={path} style="stroke" strokeWidth={20} strokeCap="round" color={WIRE_COLOR[wire]}>
                <Shadow dx={0} dy={6} blur={6} color="rgba(0,0,0,0.35)" />
              </Path>
              <Path path={path} style="stroke" strokeWidth={5} strokeCap="round" color={bomb.cream} opacity={0.35} transform={[{ translateX: -4 }, { translateY: -3 }]} />
            </Group>
          ))}
          {/* Body: lit from the top left, with a cast shadow and a rim. */}
          <Circle cx={300} cy={330} r={196}>
            <RadialGradient c={vec(230, 250)} r={290} colors={[bomb.bodyLight, bomb.panel, bomb.night]} positions={[0, 0.5, 1]} />
            <Shadow dx={0} dy={24} blur={30} color="rgba(0,0,0,0.55)" />
          </Circle>
          <Circle cx={300} cy={330} r={193} style="stroke" strokeWidth={6}>
            <LinearGradient start={vec(160, 160)} end={vec(440, 500)} colors={['rgba(255,246,229,0.35)', 'rgba(255,246,229,0)']} />
          </Circle>
          {/* Specular highlight and a smaller glint. */}
          <Oval x={170} y={200} width={130} height={90} color={bomb.cream} opacity={0.32}>
            <BlurMask blur={22} style="normal" />
          </Oval>
          <Circle cx={212} cy={226} r={14} color={bomb.cream} opacity={0.85}>
            <BlurMask blur={3} style="normal" />
          </Circle>
          {/* The timer face: a glowing LED readout. */}
          <RoundedRect x={196} y={352} width={208} height={84} r={42} color={bomb.night}>
            <Shadow dx={0} dy={2} blur={4} color="rgba(255,246,229,0.25)" inner />
          </RoundedRect>
          {[252, 300, 348].map((cx, index) => (
            <Group key={cx}>
              <Circle cx={cx} cy={394} r={16} color={index === 2 ? bomb.danger : bomb.hazard} opacity={0.55}>
                <BlurMask blur={10} style="normal" />
              </Circle>
              <Circle cx={cx} cy={394} r={11} color={index === 2 ? bomb.danger : bomb.hazard} />
            </Group>
          ))}
          {/* Metal cap. */}
          <RoundedRect x={246} y={122} width={108} height={58} r={16}>
            <LinearGradient start={vec(246, 122)} end={vec(354, 180)} colors={[bomb.metalLight, bomb.muted, bomb.metalDark]} positions={[0, 0.5, 1]} />
            <Shadow dx={0} dy={8} blur={10} color="rgba(0,0,0,0.4)" />
          </RoundedRect>
          <Rect x={252} y={134} width={96} height={6} color={bomb.cream} opacity={0.35} />
          {/* Fuse: the burnt stub, then the rope that is left. */}
          <Path path={FUSE} style="stroke" strokeWidth={15} strokeCap="round" color={bomb.ropeBurnt} opacity={0.6} />
          <Path path={FUSE} style="stroke" strokeWidth={15} strokeCap="round" color={bomb.rope} start={0} end={left}>
            <DashPathEffect intervals={[10, 6]} />
          </Path>
        </Group>
      </Canvas>
      {/* The spark, on the burning tip: its own canvas so it can flicker natively. */}
      {left > 0 ? (
        <Animated.View
          style={[
            styles.spark,
            { width: 160 * scale, height: 160 * scale, left: tipAt.x * scale - 80 * scale, top: tipAt.y * scale - 80 * scale, transform: [{ scale: sparkScale }, { rotate: sparkTurn }] },
          ]}
        >
          <Spark size={160 * scale} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** A point `fraction` of the way along the fuse rope. */
function pointAlong(fraction: number) {
  const measure = Skia.ContourMeasureIter(FUSE, false, 1).next();
  if (measure === null) return { x: 300, y: 132 };
  const [position] = measure.getPosTan(measure.length() * fraction);
  return { x: position.x, y: position.y };
}

function wirePaths() {
  return WIRES.map((wire, index) => {
    const x = 222 + index * 52;
    const spread = (index - 1.5) * 38;
    return { wire, path: Skia.Path.MakeFromSVGString(`M ${x} 500 C ${x} 540, ${x + spread * 0.6} 560, ${x + spread} 590`)! };
  });
}

/** A glowing, many-pointed spark. */
function Spark({ size }: { readonly size: number }) {
  const s = size / 160;
  const star = useMemo(() => starPath(80, 80, 44, 14, 8), []);
  const small = useMemo(() => starPath(80, 80, 24, 8, 6), []);
  return (
    <Canvas style={{ width: size, height: size }}>
      <Group transform={[{ scale: s }]}>
        <Circle cx={80} cy={80} r={70}>
          <RadialGradient c={vec(80, 80)} r={70} colors={['rgba(255,200,61,0.95)', 'rgba(255,138,61,0.45)', 'rgba(255,138,61,0)']} positions={[0, 0.45, 1]} />
        </Circle>
        <Path path={star} color={bomb.hazard}>
          <BlurMask blur={4} style="solid" />
        </Path>
        <Path path={small} color={bomb.cream} />
      </Group>
    </Canvas>
  );
}

/** The blast: a flash, a fireball that blooms outward, and smoke that drifts. */
export function SkiaExplosion({ size, reduceMotion }: { readonly size: number; readonly reduceMotion: boolean }) {
  const [t] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(t, { toValue: 1, duration: 1100, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true }).start();
  }, [reduceMotion, t]);
  const fire = t.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] });
  const smoke = t.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.3] });
  const smokeFade = t.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.9, 0.6] });
  const flash = t.interpolate({ inputRange: [0, 0.12, 0.5], outputRange: [0, 1, 0], extrapolate: 'clamp' });
  const s = size / 600;
  const burst = useMemo(() => starPath(300, 300, 280, 160, 16), []);
  const inner = useMemo(() => starPath(300, 300, 200, 120, 12), []);
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: smokeFade, transform: [{ scale: smoke }] }]}>
        <Canvas style={{ width: size, height: size }}>
          <Group transform={[{ scale: s }]}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <Circle key={i} cx={300 + Math.cos(i * 0.9) * 190} cy={300 + Math.sin(i * 0.9) * 160} r={90 + (i % 3) * 22} color={bomb.panelEdge}>
                <BlurMask blur={26} style="normal" />
              </Circle>
            ))}
          </Group>
        </Canvas>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: fire }] }]}>
        <Canvas style={{ width: size, height: size }}>
          <Group transform={[{ scale: s }]}>
            <Path path={burst}>
              <RadialGradient c={vec(300, 300)} r={290} colors={[bomb.cream, bomb.hazard, bomb.spark, bomb.danger]} positions={[0, 0.35, 0.7, 1]} />
              <BlurMask blur={6} style="solid" />
            </Path>
            <Path path={inner}>
              <RadialGradient c={vec(300, 300)} r={200} colors={[bomb.white, bomb.cream, bomb.hazard]} positions={[0, 0.5, 1]} />
            </Path>
          </Group>
        </Canvas>
      </Animated.View>
      <Animated.View style={[styles.flash, { opacity: flash }]} />
    </View>
  );
}

/** The defuse: a calm green glow, an expanding ring and a check mark. */
export function SkiaDefused({ size, reduceMotion }: { readonly size: number; readonly reduceMotion: boolean }) {
  const [t] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(t, { toValue: 1, duration: 800, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true }).start();
  }, [reduceMotion, t]);
  const ring = t.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.15] });
  const ringFade = t.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.9, 0.5, 0] });
  const pop = t.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.6, 1.08, 1] });
  const s = size / 600;
  const check = useMemo(() => Skia.Path.MakeFromSVGString('M 205 310 L 268 372 L 400 236')!, []);
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: ringFade, transform: [{ scale: ring }] }]}>
        <Canvas style={{ width: size, height: size }}>
          <Circle cx={300 * s} cy={300 * s} r={260 * s} style="stroke" strokeWidth={22 * s} color={bomb.safe}>
            <BlurMask blur={6 * s} style="solid" />
          </Circle>
        </Canvas>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: pop }] }]}>
        <Canvas style={{ width: size, height: size }}>
          <Group transform={[{ scale: s }]}>
            <Circle cx={300} cy={300} r={200} color={bomb.safe} opacity={0.4}>
              <BlurMask blur={40} style="normal" />
            </Circle>
            <Circle cx={300} cy={300} r={170}>
              <RadialGradient c={vec(250, 240)} r={240} colors={[bomb.safeLight, bomb.safe, bomb.safeDark]} positions={[0, 0.55, 1]} />
              <Shadow dx={0} dy={16} blur={24} color="rgba(0,0,0,0.45)" />
            </Circle>
            <Path path={check} style="stroke" strokeWidth={40} strokeCap="round" strokeJoin="round" color={bomb.cream}>
              <Shadow dx={0} dy={4} blur={6} color="rgba(0,0,0,0.3)" />
            </Path>
          </Group>
        </Canvas>
      </Animated.View>
    </View>
  );
}

/** Hazard tape along an edge of the stage, scrolling slowly. */
export function HazardStripes({ width, height, reduceMotion }: { readonly width: number; readonly height: number; readonly reduceMotion: boolean }) {
  const t = useLoop(4000, reduceMotion);
  const shift = t.interpolate({ inputRange: [0, 1], outputRange: [0, -80] });
  const stripes = useMemo(() => {
    const path = Skia.Path.Make();
    for (let i = 0; i < Math.ceil(width / 80) + 3; i += 1) {
      const x = i * 80;
      path.moveTo(x, 0);
      path.lineTo(x + 40, 0);
      path.lineTo(x + 40 - height, height);
      path.lineTo(x - height, height);
      path.close();
    }
    return path;
  }, [height, width]);
  return (
    <View style={{ width, height, overflow: 'hidden' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={{ transform: [{ translateX: shift }] }}>
        <Canvas style={{ width: width + 160, height }}>
          <Rect x={0} y={0} width={width + 160} height={height} color={bomb.hazard} />
          <Path path={stripes} color={bomb.night} />
        </Canvas>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  spark: { position: 'absolute' },
  flash: { ...StyleSheet.absoluteFill, backgroundColor: bomb.cream, borderRadius: 9999 },
});
