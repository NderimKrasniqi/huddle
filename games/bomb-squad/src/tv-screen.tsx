import type { GamePlayer, TvGameScreenProps } from '@huddle/domain';
import { AvatarPortrait, HuddleText } from '@huddle/ui/game-kit';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions, type TextStyle } from 'react-native';

import { BRIEF_SECONDS, DEFUSE_POINTS, HOW_TO_SECONDS, REVEAL_SECONDS, SABOTAGE_POINTS } from './logic';
import { useCountdownSeconds, useReducedMotion, WIRE_COLOR, wireName } from './presentation';
import { HazardStripes, SkiaBomb, SkiaDefused, SkiaExplosion } from './skia-art';
import { bomb, FONT } from './theme';
import type { BombState } from './types';

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;

/** The TV: the bomb on its stage. Shows no secret until the room has cut a wire. */
export function BombSquadTvScreen({ state, players, clockRemainingMs, hostNickname }: TvGameScreenProps<BombState>) {
  const viewport = useWindowDimensions();
  const scale = Math.min(viewport.width / STAGE_WIDTH, viewport.height / STAGE_HEIGHT) || 1;
  const reduceMotion = useReducedMotion();
  const fallback = state.phase === 'howTo' ? HOW_TO_SECONDS : state.phase === 'brief' ? BRIEF_SECONDS : state.phase === 'debate' ? state.debateSeconds : REVEAL_SECONDS;
  const seconds = useCountdownSeconds(state.phase === 'finished' ? 0 : clockRemainingMs, fallback, `${state.round}:${state.phase}`);
  const label = `BOMB ${Math.min(state.round + 1, state.roundCount)} OF ${state.roundCount}`;

  return (
    <View style={styles.viewport} pointerEvents="none" focusable={false} accessible={false} testID="bomb-tv-screen">
      <View style={[styles.stage, { transform: [{ scale }] }]}>
        <View style={styles.stripesTop}><HazardStripes width={STAGE_WIDTH} height={28} reduceMotion={reduceMotion} /></View>
        <View style={styles.stripesBottom}><HazardStripes width={STAGE_WIDTH} height={28} reduceMotion={reduceMotion} /></View>
        {state.phase === 'debate' && seconds <= 10 ? <DangerPulse reduceMotion={reduceMotion} /> : null}
        <Text size={30} color={bomb.muted} tracking={6} style={styles.label}>{state.phase === 'finished' ? 'FINAL SCORES' : state.phase === 'howTo' ? ' ' : label}</Text>
        {state.phase === 'howTo' ? <HowTo state={state} seconds={seconds} hostNickname={hostNickname} reduceMotion={reduceMotion} /> : null}
        {state.phase === 'brief' ? <Brief seconds={seconds} reduceMotion={reduceMotion} /> : null}
        {state.phase === 'debate' ? <Debate state={state} players={players} seconds={seconds} reduceMotion={reduceMotion} /> : null}
        {state.phase === 'reveal' ? <Reveal state={state} players={players} seconds={seconds} hostNickname={hostNickname} reduceMotion={reduceMotion} /> : null}
        {state.phase === 'finished' ? <Finished state={state} players={players} /> : null}
      </View>
    </View>
  );
}

const HOW_TO_STEPS = [
  { title: 'Read', line: 'Your phone shows a secret clue about the safe wire.' },
  { title: 'Argue', line: 'Talk it out loud. Share your clue, or bend it.' },
  { title: 'Cut', line: 'Vote on your phone. The most-cut wire gets cut.' },
] as const;

/** The rules, once, before the first bomb: three steps and the twist. */
function HowTo({
  state,
  seconds,
  hostNickname,
  reduceMotion,
}: {
  readonly state: BombState;
  readonly seconds: number;
  readonly hostNickname?: string;
  readonly reduceMotion: boolean;
}) {
  const saboteurs = state.standings.length >= 7 ? 'Two of you are saboteurs' : 'One of you is a saboteur';
  return (
    <View
      style={styles.howTo}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`How to play Bomb Squad. ${HOW_TO_STEPS.map((step) => `${step.title}: ${step.line}`).join(' ')} ${saboteurs}, with a false clue. Defused: honest players score ${DEFUSE_POINTS}. Boom: saboteurs score ${SABOTAGE_POINTS}. First bomb in ${seconds} seconds.`}
    >
      <View style={styles.howToHead}>
        <SkiaBomb size={170} fuse={1} urgency={0} reduceMotion={reduceMotion} />
        <View style={styles.howToTitle}>
          <Text size={30} color={bomb.hazard} tracking={6} weight="bold">HOW TO PLAY</Text>
          <Text size={88} weight="black">Bomb Squad</Text>
        </View>
      </View>
      <View style={styles.steps}>
        {HOW_TO_STEPS.map((step, index) => (
          <Rise key={step.title} delay={300 + index * 450} reduceMotion={reduceMotion}>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text size={44} weight="black" color={bomb.night}>{String(index + 1)}</Text>
              </View>
              <Text size={52} weight="black">{step.title}</Text>
              <Text size={30} color={bomb.muted}>{step.line}</Text>
            </View>
          </Rise>
        ))}
      </View>
      <Rise delay={1800} reduceMotion={reduceMotion}>
        <View style={styles.twist}>
          <Text size={38} weight="black" color={bomb.night}>{`${saboteurs}. Their clue is a lie.`}</Text>
          <Text size={28} weight="bold" color={bomb.night}>
            {`Defused: the squad scores +${DEFUSE_POINTS}.  Boom: saboteurs score +${SABOTAGE_POINTS}.  A tie blows up.`}
          </Text>
        </View>
      </Rise>
      <Text size={30} color={bomb.muted}>{`First bomb in ${seconds}s · ${hostNickname ?? 'The host'} can start sooner`}</Text>
    </View>
  );
}

/** Slides up and fades in after `delay`; still under reduced motion. */
function Rise({ children, delay, reduceMotion }: { readonly children: ReactNode; readonly delay: number; readonly reduceMotion: boolean }) {
  const [t] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(t, { toValue: 1, duration: 420, delay, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true }).start();
  }, [delay, reduceMotion, t]);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  return <Animated.View style={{ opacity: t, transform: [{ translateY }] }}>{children}</Animated.View>;
}

function Brief({ seconds, reduceMotion }: { readonly seconds: number; readonly reduceMotion: boolean }) {
  return (
    <View style={styles.center} accessible accessibilityRole="text" accessibilityLabel={`Check your phone. One of you is lying. Debate starts in ${seconds} seconds.`}>
      <SkiaBomb size={460} fuse={1} urgency={0.1} reduceMotion={reduceMotion} />
      <Text size={96} weight="black">Check your phone.</Text>
      <Text size={48} color={bomb.hazard} weight="bold">One of you is lying.</Text>
    </View>
  );
}

function Debate({ state, players, seconds, reduceMotion }: { readonly state: BombState; readonly players: readonly GamePlayer[]; readonly seconds: number; readonly reduceMotion: boolean }) {
  const playing = state.standings.length;
  const voted = state.votedCount ?? 0;
  // The shaking builds as the clock runs down.
  const urgency = Math.min(1, Math.max(0, 1 - seconds / state.debateSeconds));
  return (
    <View style={styles.debate} accessible accessibilityRole="text" accessibilityLabel={`Argue, then cut a wire on your phone. ${seconds} seconds left. ${voted} of ${playing} have voted.`}>
      <View style={styles.debateTop}>
        <Text size={64} weight="black">Which wire do we cut?</Text>
        <View style={[styles.timer, seconds <= 10 ? styles.timerHot : null]}>
          <Text size={96} weight="black" color={seconds <= 10 ? bomb.night : bomb.cream}>{String(seconds)}</Text>
        </View>
      </View>
      <View style={styles.debateMiddle}>
        <SkiaBomb size={500} fuse={1 - urgency} urgency={urgency} reduceMotion={reduceMotion} />
      </View>
      <View style={styles.footer}>
        <Text size={40} weight="bold">{`${voted} of ${playing} have cut`}</Text>
        <View style={styles.faces}>
          {players.filter((player) => state.standings.some((standing) => standing.playerId === player.playerId)).map((player) => (
            <AvatarPortrait key={player.playerId} avatarId={player.avatar} displayName={player.nickname} size={84} disabled={player.away} />
          ))}
        </View>
      </View>
    </View>
  );
}

function Reveal({
  state,
  players,
  seconds,
  hostNickname,
  reduceMotion,
}: {
  readonly state: BombState;
  readonly players: readonly GamePlayer[];
  readonly seconds: number;
  readonly hostNickname?: string;
  readonly reduceMotion: boolean;
}) {
  const result = state.results[state.round];
  const deal = state.rounds[state.round];
  if (result === undefined || deal === undefined) return null;
  const saboteurs = players.filter((player) => deal.saboteurs.includes(player.playerId));
  const last = state.round + 1 >= state.roundCount;
  const headline = result.defused ? 'DEFUSED!' : 'BOOM!';
  const cutLine = result.cut === null ? 'Nobody agreed in time.' : `You cut ${wireName(result.cut)}.`;
  return (
    <View
      style={styles.center}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${headline} ${cutLine} The safe wire was ${deal.safe ?? 'hidden'}. Saboteurs: ${saboteurs.map((player) => player.nickname).join(', ')}.`}
    >
      <View style={styles.revealArt}>
        {result.defused ? <SkiaDefused size={250} reduceMotion={reduceMotion} /> : <SkiaExplosion size={300} reduceMotion={reduceMotion} />}
      </View>
      <Pop reduceMotion={reduceMotion}>
        <Text size={120} weight="black" color={result.defused ? bomb.safe : bomb.danger}>{headline}</Text>
      </Pop>
      <Text size={48} weight="bold">
        {cutLine}
        {deal.safe === undefined ? '' : ` The safe wire was `}
        {deal.safe === undefined ? null : <Text size={48} weight="black" color={WIRE_COLOR[deal.safe]}>{wireName(deal.safe)}</Text>}
        {deal.safe === undefined ? '' : '.'}
      </Text>
      <View style={styles.saboteurs}>
        <Text size={36} color={bomb.muted} tracking={4}>{saboteurs.length === 1 ? 'THE SABOTEUR' : 'THE SABOTEURS'}</Text>
        <View style={styles.saboteurRow}>
          {saboteurs.map((player) => (
            <View key={player.playerId} style={styles.saboteur}>
              <AvatarPortrait avatarId={player.avatar} displayName={player.nickname} size={112} />
              <Text size={40} weight="bold" numberOfLines={1}>{player.nickname}</Text>
              <Text size={32} color={(result.gains[player.playerId] ?? 0) > 0 ? bomb.hazard : bomb.muted}>
                {(result.gains[player.playerId] ?? 0) > 0 ? `+${result.gains[player.playerId]}` : '+0'}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <Text size={32} color={bomb.muted}>
        {`${last ? 'Final scores' : 'Next bomb'} in ${seconds}s · ${hostNickname ?? 'The host'} can move on sooner`}
      </Text>
    </View>
  );
}

function Finished({ state, players }: { readonly state: BombState; readonly players: readonly GamePlayer[] }) {
  const ranked = [...state.standings].sort((a, b) => b.score - a.score);
  const top = ranked[0]?.score ?? 0;
  const defused = state.results.filter((result) => result.defused).length;
  return (
    <View style={styles.center} accessible accessibilityRole="text" accessibilityLabel={`${defused} of ${state.roundCount} bombs defused.`}>
      <Text size={84} weight="black">{`${defused} of ${state.roundCount} bombs defused`}</Text>
      <View style={styles.board}>
        {ranked.slice(0, 10).map((standing) => {
          const player = players.find((candidate) => candidate.playerId === standing.playerId);
          if (player === undefined) return null;
          const winner = standing.score === top && top > 0;
          return (
            <View key={standing.playerId} style={[styles.boardRow, winner ? styles.boardWinner : null]}>
              <AvatarPortrait avatarId={player.avatar} displayName={player.nickname} size={64} />
              <Text size={40} weight="bold" numberOfLines={1} style={styles.boardName}>{player.nickname}</Text>
              <Text size={40} weight="black" color={winner ? bomb.hazard : bomb.cream}>{String(standing.score)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** A red glow that throbs at the edges of the stage in the last ten seconds. */
function DangerPulse({ reduceMotion }: { readonly reduceMotion: boolean }) {
  const [t] = useState(() => new Animated.Value(reduceMotion ? 0.5 : 0));
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 500, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, t]);
  return <Animated.View style={[styles.danger, { opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.55] }) }]} />;
}

function Pop({ children, reduceMotion }: { readonly children: ReactNode; readonly reduceMotion: boolean }) {
  const [scale] = useState(() => new Animated.Value(reduceMotion ? 1 : 0.6));
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(scale, { toValue: 1, duration: 280, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true }).start();
  }, [reduceMotion, scale]);
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

function Text({
  children,
  size,
  weight = 'regular',
  color = bomb.cream,
  tracking,
  numberOfLines,
  style,
}: {
  readonly children: ReactNode;
  readonly size: number;
  readonly weight?: keyof typeof FONT;
  readonly color?: string;
  readonly tracking?: number;
  readonly numberOfLines?: number;
  readonly style?: TextStyle;
}) {
  return (
    <HuddleText
      numberOfLines={numberOfLines}
      align="center"
      style={[{ fontFamily: FONT[weight], fontSize: size, lineHeight: Math.round(size * 1.18), color, letterSpacing: tracking }, style]}
    >
      {children}
    </HuddleText>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, backgroundColor: bomb.night, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT, paddingHorizontal: 96, paddingTop: 54, paddingBottom: 72 },
  label: { marginTop: 8 },
  howTo: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
  howToHead: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  howToTitle: { alignItems: 'flex-start' },
  steps: { flexDirection: 'row', gap: 32 },
  step: { width: 480, minHeight: 260, alignItems: 'center', gap: 10, padding: 28, borderRadius: 40, backgroundColor: bomb.panel, borderWidth: 4, borderColor: bomb.panelEdge },
  stepNumber: { width: 72, height: 72, borderRadius: 36, backgroundColor: bomb.hazard, alignItems: 'center', justifyContent: 'center' },
  twist: { alignItems: 'center', gap: 8, paddingHorizontal: 48, paddingVertical: 20, borderRadius: 40, backgroundColor: bomb.hazard },
  stripesTop: { position: 'absolute', left: 0, top: 0 },
  stripesBottom: { position: 'absolute', left: 0, bottom: 0 },
  danger: { ...StyleSheet.absoluteFill, borderWidth: 60, borderColor: bomb.danger },
  revealArt: { height: 250, marginTop: 24, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  debate: { flex: 1 },
  debateTop: { alignItems: 'center', gap: 16, marginTop: 8 },
  timer: { minWidth: 180, paddingHorizontal: 32, borderRadius: 999, backgroundColor: bomb.panel, borderWidth: 4, borderColor: bomb.panelEdge, alignItems: 'center' },
  timerHot: { backgroundColor: bomb.hazard, borderColor: bomb.hazard },
  debateMiddle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { alignItems: 'center', gap: 16, marginTop: 24 },
  faces: { flexDirection: 'row', gap: 20 },
  saboteurs: { alignItems: 'center', gap: 16, marginTop: 16 },
  saboteurRow: { flexDirection: 'row', gap: 64 },
  saboteur: { alignItems: 'center', gap: 8, maxWidth: 320 },
  board: { width: 1100, gap: 12, marginTop: 16 },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 24, paddingHorizontal: 28, paddingVertical: 8, borderRadius: 999, backgroundColor: bomb.panel },
  boardWinner: { borderWidth: 4, borderColor: bomb.hazard },
  boardName: { flex: 1, textAlign: 'left' },
});
