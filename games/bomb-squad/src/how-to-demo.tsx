/**
 * The animated "how to play" on the TV: four agents, their clues, one lie, a
 * cut wire and an accusation, looping in four beats. Drawn with Skia and moved
 * with React Native `Animated` (games may not use Reanimated), so each moving
 * part is its own small canvas inside an animated view.
 *
 * TV only. The agents are generic figures, never the room's real avatars: a
 * real face marked as the liar would read as an accusation before the game.
 * Paths are built from SVG strings, which the phone's Skia stub supports.
 */
import { BlurMask, Canvas, Circle, Group, LinearGradient, Path, RadialGradient, RoundedRect, Shadow, Skia, vec } from '@shopify/react-native-skia';
import { GameText } from '@huddle/ui/game-kit';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { WIRE_COLOR } from './presentation';
import { SkiaBomb } from './skia-art';
import { bomb } from './theme';
import type { Wire } from './types';

/** How long each beat holds before the next. */
const DEMO_BEAT_MS = 2500;
const DEMO_BEATS = 4;

const WIDTH = 1500;
const HEIGHT = 440;
const AGENT_X = [120, 330, 540, 750] as const;
/** The demo's liar: always the third agent, a figure, never a real player. */
const LIAR = 2;
/** The wire each agent's clue points at; the liar's points elsewhere. */
const CLUE_WIRES: readonly Wire[] = ['red', 'red', 'blue', 'red'];

const BUBBLE_TAIL = Skia.Path.MakeFromSVGString('M 58 92 L 70 112 L 82 92 Z')!;
const ARROW = Skia.Path.MakeFromSVGString('M 0 20 L 60 20 L 60 6 L 90 30 L 60 54 L 60 40 L 0 40 Z')!;
const BLADE = Skia.Path.MakeFromSVGString('M 60 60 C 80 40, 104 28, 118 26 C 104 40, 84 54, 60 64 Z')!;

/** Which beat is showing, advancing every `DEMO_BEAT_MS` while motion is allowed. */
export function useDemoBeat(reduceMotion: boolean): number {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => setBeat((current) => (current + 1) % DEMO_BEATS), DEMO_BEAT_MS);
    return () => clearInterval(timer);
  }, [reduceMotion]);
  return beat;
}

/** 0 → 1 once at the start of each beat. */
function useBeatProgress(beat: number): Animated.Value {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    t.setValue(0);
    const run = Animated.timing(t, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [beat, t]);
  return t;
}

/** A gentle back-and-forth while the agents argue. */
function useWobble(active: boolean): Animated.Value {
  const [w] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!active) {
      w.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(w, { toValue: 1, duration: 180, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(w, { toValue: -1, duration: 360, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(w, { toValue: 0, duration: 180, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, w]);
  return w;
}

/**
 * A section of `t` from `from` to `to`, held at both ends. The native driver
 * cannot ease inside an interpolation, so the section is shaped by a midpoint
 * that is 80% of the way there: a cheap ease-out.
 */
function span(t: Animated.Value, from: number, to: number, out: [number, number] = [0, 1]) {
  const mid = from + (to - from) * 0.35;
  return t.interpolate({ inputRange: [from, mid, to], outputRange: [out[0], out[0] + (out[1] - out[0]) * 0.8, out[1]], extrapolate: 'clamp' });
}

export function HowToDemo({ beat }: { readonly beat: number }) {
  const t = useBeatProgress(beat);
  const wobble = useWobble(beat === 1);
  return (
    <View style={styles.stage} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* The bomb, with a loose wire hanging under it for the cut. */}
      <View style={styles.bomb}>
        <SkiaBomb size={330} fuse={0.7} urgency={0.15} reduceMotion={false} />
      </View>
      <CutWire beat={beat} t={t} />
      {AGENT_X.map((x, index) => (
        <AgentWithClue key={x} index={index} x={x} beat={beat} t={t} wobble={wobble} />
      ))}
      <Accusation beat={beat} t={t} />
    </View>
  );
}

function AgentWithClue({
  index,
  x,
  beat,
  t,
  wobble,
}: {
  readonly index: number;
  readonly x: number;
  readonly beat: number;
  readonly t: Animated.Value;
  readonly wobble: Animated.Value;
}) {
  const liar = index === LIAR;
  // Read: the bubbles pop in one after another, then stay.
  const pop = beat === 0 ? span(t, index * 0.12, index * 0.12 + 0.3) : 1;
  const bubbleScale = beat === 0 ? span(t, index * 0.12, index * 0.12 + 0.3, [0.9, 1]) : 1;
  // Argue: the bubbles wobble, then the lie turns red.
  const turn = wobble.interpolate({ inputRange: [-1, 1], outputRange: [`${-4 - index}deg`, `${4 + index}deg`] });
  const lie = liar ? (beat === 1 ? span(t, 0.45, 0.65) : beat >= 2 ? 1 : 0) : 0;
  const stamp = liar && beat === 1 ? span(t, 0.55, 0.75, [1.25, 1]) : 1;
  // Accuse: the agents either side lean in towards the liar.
  const lean = beat === 3 && Math.abs(index - LIAR) === 1 ? span(t, 0, 0.3, [0, index < LIAR ? 14 : -14]) : 0;
  return (
    <Animated.View style={[styles.agent, { left: x - 80, transform: [{ translateX: lean }] }]}>
      <Animated.View style={{ opacity: pop, transform: [{ scale: bubbleScale }, { rotate: turn }] }}>
        <Bubble wire={CLUE_WIRES[index]!} tone="calm" />
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: lie }]}>
          <Bubble wire={CLUE_WIRES[index]!} tone="lie" />
        </Animated.View>
        {liar ? (
          <Animated.View style={[styles.stamp, { opacity: lie, transform: [{ rotate: '-14deg' }, { scale: stamp }] }]}>
            <Stamp />
          </Animated.View>
        ) : null}
      </Animated.View>
      <Agent index={index} />
    </Animated.View>
  );
}

/** A speech bubble holding a little wire: the clue. */
function Bubble({ wire, tone }: { readonly wire: Wire; readonly tone: 'calm' | 'lie' }) {
  const fill = tone === 'lie' ? bomb.danger : bomb.cream;
  return (
    <Canvas style={styles.bubble}>
      <RoundedRect x={10} y={8} width={140} height={86} r={30} color={fill}>
        <Shadow dx={0} dy={6} blur={8} color="rgba(0,0,0,0.35)" />
      </RoundedRect>
      <Path path={BUBBLE_TAIL} color={fill} />
      <RoundedRect x={36} y={42} width={88} height={18} r={9} color={WIRE_COLOR[wire]} />
      <RoundedRect x={42} y={45} width={50} height={4} r={2} color={bomb.white} opacity={0.4} />
    </Canvas>
  );
}

/** A red "LIE" stamp; the word is drawn as text in a bordered box. */
function Stamp() {
  return (
    <View style={styles.stampBox}>
      <GameText style={styles.stampText}>LIE</GameText>
    </View>
  );
}

/** A faceless agent in a dark suit with a coloured badge. */
function Agent({ index }: { readonly index: number }) {
  const badge = [bomb.wireBlue, bomb.wireYellow, bomb.wireGreen, bomb.wireRed][index]!;
  return (
    <Canvas style={styles.figure}>
      <Group>
        <RoundedRect x={28} y={98} width={104} height={110} r={46}>
          <LinearGradient start={vec(28, 98)} end={vec(132, 208)} colors={[bomb.bodyLight, bomb.panel]} />
          <Shadow dx={0} dy={8} blur={10} color="rgba(0,0,0,0.45)" />
        </RoundedRect>
        <Circle cx={80} cy={62} r={40}>
          <RadialGradient c={vec(66, 48)} r={52} colors={[bomb.cream, bomb.rope]} />
        </Circle>
        {/* Dark glasses: every agent looks equally suspicious. */}
        <RoundedRect x={50} y={52} width={60} height={16} r={8} color={bomb.night} />
        <Circle cx={104} cy={140} r={10} color={badge} />
      </Group>
    </Canvas>
  );
}

/** Scissors close on the hanging wire, and it snaps in two. */
function CutWire({ beat, t }: { readonly beat: number; readonly t: Animated.Value }) {
  const cutting = beat === 2;
  const cut = beat >= 2;
  const slide = cutting ? span(t, 0, 0.4, [260, 0]) : beat === 3 ? 0 : 260;
  const scissorsIn = cutting ? span(t, 0, 0.15) : 0;
  const snap = cutting ? span(t, 0.4, 0.5) : 0;
  const drop = cutting ? span(t, 0.45, 0.85) : cut ? 1 : 0;
  const leftTurn = typeof drop === 'number' ? `${drop * 28}deg` : drop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '28deg'] });
  const rightTurn = typeof drop === 'number' ? `${-drop * 28}deg` : drop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-28deg'] });
  const flash = cutting ? span(t, 0.4, 0.7, [1, 0]) : 0;
  return (
    <View style={styles.wireArea}>
      <Animated.View style={[styles.wireHalf, styles.wireLeft, { transform: [{ rotate: leftTurn }] }]}>
        <WireSegment />
      </Animated.View>
      <Animated.View style={[styles.wireHalf, styles.wireRight, { transform: [{ rotate: rightTurn }] }]}>
        <WireSegment />
      </Animated.View>
      <Animated.View style={[styles.cutFlash, { opacity: flash }]}>
        <Canvas style={styles.flashCanvas}>
          <Circle cx={50} cy={50} r={40} color={bomb.hazard}>
            <BlurMask blur={14} style="normal" />
          </Circle>
          <Circle cx={50} cy={50} r={14} color={bomb.cream} />
        </Canvas>
      </Animated.View>
      <Animated.View style={[styles.scissors, { opacity: cutting ? scissorsIn : 0, transform: [{ translateX: slide }] }]}>
        <Scissors closed={snap} />
      </Animated.View>
    </View>
  );
}

function WireSegment() {
  return (
    <Canvas style={styles.segment}>
      <RoundedRect x={0} y={4} width={130} height={20} r={10} color={bomb.wireRed}>
        <Shadow dx={0} dy={4} blur={4} color="rgba(0,0,0,0.35)" />
      </RoundedRect>
      <RoundedRect x={8} y={7} width={100} height={5} r={2.5} color={bomb.white} opacity={0.35} />
    </Canvas>
  );
}

/** Two blades on a pivot; `closed` (0 → 1) brings them together. */
function Scissors({ closed }: { readonly closed: Animated.AnimatedInterpolation<number> | number }) {
  const open = typeof closed === 'number' ? `${(1 - closed) * 18}deg` : closed.interpolate({ inputRange: [0, 1], outputRange: ['18deg', '0deg'] });
  const openBack = typeof closed === 'number' ? `${-(1 - closed) * 18}deg` : closed.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '0deg'] });
  return (
    <View style={styles.scissorsBox}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: open }] }]}>
        <ScissorHalf flip={false} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: openBack }] }]}>
        <ScissorHalf flip />
      </Animated.View>
    </View>
  );
}

function ScissorHalf({ flip }: { readonly flip: boolean }) {
  return (
    <Canvas style={styles.scissorsBox}>
      <Group transform={flip ? [{ translateY: 120 }, { scaleY: -1 }] : []}>
        <Path path={BLADE}>
          <LinearGradient start={vec(60, 30)} end={vec(118, 60)} colors={[bomb.metalLight, bomb.metalDark]} />
        </Path>
        <Circle cx={36} cy={72} r={20} style="stroke" strokeWidth={9} color={bomb.spark} />
      </Group>
      <Circle cx={60} cy={60} r={6} color={bomb.night} />
    </Canvas>
  );
}

/** Arrows from the others point at the liar, a ring closes round them, and +50 pops. */
function Accusation({ beat, t }: { readonly beat: number; readonly t: Animated.Value }) {
  if (beat !== 3) return null;
  const ring = span(t, 0.1, 0.4);
  const ringScale = span(t, 0.1, 0.4, [1.3, 1]);
  const points = span(t, 0.35, 0.6);
  const pointsLift = span(t, 0.35, 0.6, [20, 0]);
  const arrows = span(t, 0, 0.25);
  const liarX = AGENT_X[LIAR];
  return (
    <>
      <Animated.View style={[styles.ring, { left: liarX - 110, opacity: ring, transform: [{ scale: ringScale }] }]}>
        <Canvas style={styles.ringCanvas}>
          <Circle cx={110} cy={110} r={100} style="stroke" strokeWidth={10} color={bomb.danger}>
            <BlurMask blur={4} style="solid" />
          </Circle>
        </Canvas>
      </Animated.View>
      {[
        { left: AGENT_X[0] + 20, flip: false },
        { left: AGENT_X[3] - 120, flip: true },
      ].map(({ left, flip }) => (
        <Animated.View key={left} style={[styles.arrow, { left, opacity: arrows, transform: flip ? [{ scaleX: -1 }] : [] }]}>
          <Canvas style={styles.arrowCanvas}>
            <Path path={ARROW} color={bomb.hazard} />
          </Canvas>
        </Animated.View>
      ))}
      <Animated.View style={[styles.points, { left: liarX - 60, opacity: points, transform: [{ translateY: pointsLift }] }]}>
        <GameText style={styles.pointsText}>+50</GameText>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  stage: { width: WIDTH, height: HEIGHT },
  bomb: { position: 'absolute', left: 1020, top: 0 },
  agent: { position: 'absolute', top: 40, width: 160, alignItems: 'center' },
  bubble: { width: 160, height: 116 },
  figure: { width: 160, height: 220 },
  stamp: { position: 'absolute', top: 22, left: 26 },
  stampBox: { paddingHorizontal: 14, paddingVertical: 2, borderRadius: 12, borderWidth: 5, borderColor: bomb.cream, backgroundColor: bomb.danger },
  stampText: { fontFamily: 'Nunito_900Black', fontSize: 40, lineHeight: 48, color: bomb.cream, letterSpacing: 4 },
  wireArea: { position: 'absolute', left: 1040, top: 350, width: 300, height: 80 },
  wireHalf: { position: 'absolute', top: 20, width: 130, height: 28 },
  wireLeft: { left: 20, transformOrigin: 'left center' },
  wireRight: { left: 150, transformOrigin: 'right center' },
  segment: { width: 130, height: 28 },
  cutFlash: { position: 'absolute', left: 100, top: -16 },
  flashCanvas: { width: 100, height: 100 },
  scissors: { position: 'absolute', left: 90, top: -42 },
  scissorsBox: { width: 120, height: 120 },
  ring: { position: 'absolute', top: 150 },
  ringCanvas: { width: 220, height: 220 },
  arrow: { position: 'absolute', top: 360 },
  arrowCanvas: { width: 100, height: 60 },
  points: { position: 'absolute', top: 0, width: 120, alignItems: 'center' },
  pointsText: { fontFamily: 'Nunito_900Black', fontSize: 56, lineHeight: 66, color: bomb.hazard },
});
