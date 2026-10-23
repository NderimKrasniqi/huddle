import type { GamePlayer, TvGameScreenProps } from '@huddle/domain';
import { BlurMask, Canvas, Circle, RadialGradient, vec } from '@shopify/react-native-skia';
import { AvatarPortrait, useCountdownSeconds, useSystemReducedMotion } from '@huddle/ui/game-kit';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';

import { BLOB_RADIUS, PUCK_RADIUS, puckOwner, simulateRound } from './logic';
import { beatKey, HOW_TO_STEPS, knockoutLine, phaseSeconds } from './presentation';
import { SumoText as Text } from './text';
import { sumo } from './theme';
import type { SumoState } from './types';

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;
const ARENA_PX = 380;
const ARENA_CENTER = { x: STAGE_WIDTH / 2, y: 590 };
const REPLAY_MS = 4300;

export function SumoBumpersTvScreen({ state, players, clockRemainingMs, hostNickname }: TvGameScreenProps<SumoState>) {
  const viewport = useWindowDimensions();
  const scale = Math.min(viewport.width / STAGE_WIDTH, viewport.height / STAGE_HEIGHT) || 1;
  const reduceMotion = useSystemReducedMotion() ?? true;
  const seconds = useCountdownSeconds(state.phase === 'finished' ? 0 : clockRemainingMs, phaseSeconds(state), beatKey(state));
  const playing = players.filter((player) => state.standings.some((standing) => standing.playerId === player.playerId));

  return (
    <View style={styles.viewport} pointerEvents="none" focusable={false} accessible={false} testID="sumo-tv-screen">
      <View style={[styles.stage, { transform: [{ scale }] }]}>
        <Arena radius={state.phase === 'aim' ? state.arenaRadius : state.phase === 'replay' ? state.lastRound?.arenaRadius ?? state.arenaRadius : undefined} />
        {state.phase === 'howTo' ? <HowTo state={state} players={playing} seconds={seconds} hostNickname={hostNickname} /> : null}
        {state.phase === 'aim' || state.phase === 'replay' ? (
          <Match state={state} players={playing} seconds={seconds} reduceMotion={reduceMotion} />
        ) : null}
        {state.phase === 'matchOver' ? <MatchOver state={state} players={playing} seconds={seconds} /> : null}
        {state.phase === 'finished' ? <Finished state={state} players={playing} /> : null}
      </View>
    </View>
  );
}

function Arena({ radius }: { readonly radius: number | undefined }) {
  const px = (radius ?? 0) * ARENA_PX;
  const cx = ARENA_CENTER.x;
  const cy = ARENA_CENTER.y;
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Circle cx={STAGE_WIDTH / 2} cy={STAGE_HEIGHT / 2} r={STAGE_WIDTH}>
        <RadialGradient c={vec(cx, cy)} r={STAGE_WIDTH * 0.7} colors={[sumo.wave, sumo.sea, sumo.seaDeep]} positions={[0, 0.45, 1]} />
      </Circle>
      {radius === undefined ? null : (
        <>
          <Circle cx={cx} cy={cy + 14} r={px + 6} color={sumo.seaDeep} opacity={0.6}>
            <BlurMask blur={18} style="normal" />
          </Circle>
          <Circle cx={cx} cy={cy} r={px + 10} color={sumo.hazard} />
          <Circle cx={cx} cy={cy} r={px}>
            <RadialGradient c={vec(cx - px * 0.3, cy - px * 0.35)} r={px * 1.4} colors={[sumo.rim, sumo.ice, sumo.iceShade]} positions={[0, 0.45, 1]} />
          </Circle>
          <Circle cx={cx} cy={cy} r={px * 0.18} color={sumo.iceShade} opacity={0.6} />
        </>
      )}
    </Canvas>
  );
}

function toPx(point: { readonly x: number; readonly y: number }) {
  return { left: ARENA_CENTER.x + point.x * ARENA_PX, top: ARENA_CENTER.y + point.y * ARENA_PX };
}

function Match({ state, players, seconds, reduceMotion }: { readonly state: SumoState; readonly players: readonly GamePlayer[]; readonly seconds: number; readonly reduceMotion: boolean }) {
  const ghosts = players.filter((player) => state.blobs[player.playerId]?.alive === false);
  const aliveCount = players.length - ghosts.length;
  const replay = state.phase === 'replay' ? state.lastRound : undefined;
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.header}>
        <Text size={30} color={sumo.muted} tracking={6}>{`MATCH ${state.match + 1} OF ${state.matchCount} · ROUND ${state.round + 1}`}</Text>
        <Text size={64} weight="black">{state.phase === 'aim' ? 'Aim on your phone!' : 'Launch!'}</Text>
      </View>
      {state.phase === 'aim' ? (
        <View style={[styles.timer, seconds <= 3 ? styles.timerHot : null]}>
          <Text size={80} weight="black" color={seconds <= 3 ? sumo.ink : sumo.cream}>{String(seconds)}</Text>
        </View>
      ) : null}
      {replay ? (
        <Replay state={state} players={players} reduceMotion={reduceMotion} />
      ) : (
        players.map((player) => {
          const blob = state.blobs[player.playerId];
          if (blob === undefined || !blob.alive) return null;
          return <BlobAt key={player.playerId} player={player} point={blob} aimed={false} />;
        })
      )}
      <View style={styles.footer}>
        {state.phase === 'aim' ? (
          <Text size={36} weight="bold">{`${state.aimedCount ?? 0} of ${players.length} aimed · ${aliveCount} on the ice`}</Text>
        ) : null}
        {ghosts.length > 0 ? (
          <View style={styles.ghostRow}>
            <Text size={26} color={sumo.ghost} weight="bold">GHOSTS</Text>
            {ghosts.map((player) => (
              <View key={player.playerId} style={styles.ghost}>
                <AvatarPortrait avatarId={player.avatar} displayName={player.nickname} size={48} />
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function BlobAt({ player, point, aimed }: { readonly player: GamePlayer; readonly point: { readonly x: number; readonly y: number }; readonly aimed: boolean }) {
  const size = BLOB_RADIUS * ARENA_PX * 2;
  const at = toPx(point);
  return (
    <View style={[styles.blob, { left: at.left - size / 2, top: at.top - size / 2, width: size, height: size, borderRadius: size / 2 }, aimed ? styles.blobAimed : null]}>
      <AvatarPortrait avatarId={player.avatar} displayName={player.nickname} size={size - 8} disabled={player.away} />
    </View>
  );
}

function Replay({ state, players, reduceMotion }: { readonly state: SumoState; readonly players: readonly GamePlayer[]; readonly reduceMotion: boolean }) {
  const replay = state.lastRound!;
  const run = useMemo(() => simulateRound(replay.start, replay.aims, replay.arenaRadius), [replay]);
  const [progress] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  const [done, setDone] = useState(reduceMotion);
  const input = useMemo(() => run.frames.map((_, index) => index / Math.max(1, run.frames.length - 1)), [run]);
  const contact = useMemo(() => firstContact(run.frames), [run]);

  useEffect(() => {
    if (reduceMotion) return;
    const animation = Animated.sequence([
      Animated.timing(progress, { toValue: 0.08, duration: 900, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(progress, { toValue: 1, duration: REPLAY_MS - 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]);
    animation.start(() => setDone(true));
    return () => animation.stop();
  }, [progress, reduceMotion]);

  const shake =
    contact === undefined || reduceMotion
      ? 0
      : progress.interpolate({
          inputRange: [Math.max(0, contact - 0.001), contact, contact + 0.01, contact + 0.02, contact + 0.03, Math.min(1, contact + 0.04)],
          outputRange: [0, 14, -12, 8, -4, 0],
          extrapolate: 'clamp',
        });

  const ids = Object.keys(run.frames[0] ?? {});
  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: shake }] }]}>
        {ids.map((id) => {
          const owner = puckOwner(id);
          const player = players.find((candidate) => candidate.playerId === (owner ?? id));
          if (player === undefined) return null;
          const radius = (owner === undefined ? BLOB_RADIUS : PUCK_RADIUS) * ARENA_PX;
          const xs = run.frames.map((frame) => ARENA_CENTER.x + frame[id]!.x * ARENA_PX - radius);
          const ys = run.frames.map((frame) => ARENA_CENTER.y + frame[id]!.y * ARENA_PX - radius);
          const translateX = progress.interpolate({ inputRange: input, outputRange: xs });
          const translateY = progress.interpolate({ inputRange: input, outputRange: ys });
          const sinks = owner !== undefined || replay.knockedOut.includes(id);
          const opacity = sinks ? progress.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }) : 1;
          const sinkScale = sinks ? progress.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0.5] }) : 1;
          return (
            <Animated.View
              key={id}
              style={[
                styles.mover,
                { width: radius * 2, height: radius * 2, borderRadius: radius, opacity, transform: [{ translateX }, { translateY }, { scale: sinkScale }] },
                owner !== undefined ? styles.puck : styles.blob,
              ]}
            >
              {owner === undefined ? (
                <AvatarPortrait avatarId={player.avatar} displayName={player.nickname} size={radius * 2 - 8} />
              ) : (
                <View style={styles.puckCore} />
              )}
            </Animated.View>
          );
        })}
      </Animated.View>
      {done ? <Headlines state={state} players={players} /> : null}
    </>
  );
}

function firstContact(frames: ReturnType<typeof simulateRound>['frames']): number | undefined {
  const reach = BLOB_RADIUS * 2 * 1.02;
  for (let index = 1; index < frames.length; index += 1) {
    const points = Object.entries(frames[index]!).filter(([id]) => puckOwner(id) === undefined).map(([, point]) => point);
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const dx = points[i]!.x - points[j]!.x;
        const dy = points[i]!.y - points[j]!.y;
        if (dx * dx + dy * dy < reach * reach) return index / Math.max(1, frames.length - 1);
      }
    }
  }
  return undefined;
}

function Headlines({ state, players }: { readonly state: SumoState; readonly players: readonly GamePlayer[] }) {
  const knockouts = state.lastRound?.knockouts ?? [];
  return (
    <Rise>
      <View style={styles.headlines}>
        {knockouts.length === 0 ? (
          <Text size={52} weight="black" color={sumo.gold}>Everyone held on!</Text>
        ) : (
          knockouts.slice(0, 3).map((knockout) => (
            <Text key={knockout.out} size={46} weight="black" color={sumo.gold}>{knockoutLine(knockout, players)}</Text>
          ))
        )}
      </View>
    </Rise>
  );
}

function Rise({ children }: { readonly children: ReactNode }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 280, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true }).start();
  }, [t]);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [30, 0] });
  return <Animated.View style={[styles.headlineLayer, { opacity: t, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

function HowTo({ state, players, seconds, hostNickname }: { readonly state: SumoState; readonly players: readonly GamePlayer[]; readonly seconds: number; readonly hostNickname?: string }) {
  const ready = state.gotIt ?? [];
  return (
    <View style={styles.center} accessible accessibilityRole="text" accessibilityLabel={`How to play Sumo Bumpers. ${HOW_TO_STEPS.map((step) => `${step.title}: ${step.line}`).join(' ')}`}>
      <Text size={30} color={sumo.gold} tracking={6} weight="bold">HOW TO PLAY</Text>
      <Text size={88} weight="black">Sumo Bumpers</Text>
      <View style={styles.steps}>
        {HOW_TO_STEPS.map((step, index) => (
          <View key={step.title} style={styles.step}>
            <View style={styles.stepNumber}>
              <Text size={40} weight="black" color={sumo.ink}>{String(index + 1)}</Text>
            </View>
            <Text size={48} weight="black">{step.title}</Text>
            <Text size={28} color={sumo.muted}>{step.line}</Text>
          </View>
        ))}
      </View>
      <View style={styles.readyRow}>
        {players.map((player) => (
          <View key={player.playerId}>
            <AvatarPortrait avatarId={player.avatar} displayName={player.nickname} size={64} disabled={!ready.includes(player.playerId)} />
            {ready.includes(player.playerId) ? (
              <View style={styles.tick}>
                <Text size={24} weight="black" color={sumo.ink}>✓</Text>
              </View>
            ) : null}
          </View>
        ))}
        <Text size={30} color={sumo.muted} style={styles.readyText}>
          {`${ready.length} of ${players.length} ready · tap Got it · ${hostNickname ?? 'The host'} can start now · ${seconds}s`}
        </Text>
      </View>
    </View>
  );
}

function MatchOver({ state, players, seconds }: { readonly state: SumoState; readonly players: readonly GamePlayer[]; readonly seconds: number }) {
  const winnerId = state.matchWinners[state.matchWinners.length - 1];
  const winner = players.find((player) => player.playerId === winnerId);
  const last = state.match + 1 >= state.matchCount;
  return (
    <View style={styles.center}>
      <Text size={34} color={sumo.muted} tracking={6}>{`MATCH ${state.match + 1} OF ${state.matchCount}`}</Text>
      {winner ? (
        <>
          <View style={styles.crownRing}>
            <AvatarPortrait avatarId={winner.avatar} displayName={winner.nickname} size={220} />
          </View>
          <Text size={96} weight="black" color={sumo.gold} numberOfLines={1}>{`${winner.nickname} wins!`}</Text>
        </>
      ) : (
        <Text size={96} weight="black">Nobody stayed on!</Text>
      )}
      <Scores state={state} players={players} limit={5} />
      <Text size={32} color={sumo.muted}>{`${last ? 'Final scores' : 'Next match'} in ${seconds}s`}</Text>
    </View>
  );
}

function Finished({ state, players }: { readonly state: SumoState; readonly players: readonly GamePlayer[] }) {
  return (
    <View style={styles.center}>
      <Text size={84} weight="black">Final scores</Text>
      <Scores state={state} players={players} limit={10} />
    </View>
  );
}

function Scores({ state, players, limit }: { readonly state: SumoState; readonly players: readonly GamePlayer[]; readonly limit: number }) {
  const ranked = [...state.standings].sort((a, b) => b.score - a.score).slice(0, limit);
  const top = ranked[0]?.score ?? 0;
  return (
    <View style={styles.board}>
      {ranked.map((standing) => {
        const player = players.find((candidate) => candidate.playerId === standing.playerId);
        if (player === undefined) return null;
        const leader = standing.score === top && top > 0;
        return (
          <View key={standing.playerId} style={[styles.boardRow, leader ? styles.boardLeader : null]}>
            <AvatarPortrait avatarId={player.avatar} displayName={player.nickname} size={56} />
            <Text size={38} weight="bold" numberOfLines={1} align="left" style={styles.boardName}>{player.nickname}</Text>
            <Text size={38} weight="black" color={leader ? sumo.gold : sumo.cream}>{String(standing.score)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, backgroundColor: sumo.seaDeep, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT },
  header: { position: 'absolute', top: 40, left: 0, right: 0, alignItems: 'center', gap: 4 },
  timer: { position: 'absolute', top: 60, right: 140, minWidth: 150, paddingHorizontal: 28, borderRadius: 999, backgroundColor: sumo.panel, borderWidth: 4, borderColor: sumo.panelEdge, alignItems: 'center' },
  timerHot: { backgroundColor: sumo.gold, borderColor: sumo.gold },
  blob: { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: sumo.cream, borderWidth: 4, borderColor: sumo.ink },
  blobAimed: { borderColor: sumo.you },
  mover: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  puck: { backgroundColor: sumo.ghost, borderWidth: 4, borderColor: sumo.cream },
  puckCore: { width: 14, height: 14, borderRadius: 7, backgroundColor: sumo.ink },
  footer: { position: 'absolute', bottom: 36, left: 0, right: 0, alignItems: 'center', gap: 12 },
  ghostRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ghost: { opacity: 0.75 },
  headlineLayer: { position: 'absolute', left: 0, right: 0, top: 180, alignItems: 'center' },
  headlines: { alignItems: 'center', gap: 8, paddingHorizontal: 48, paddingVertical: 20, borderRadius: 40, backgroundColor: sumo.seaDeep },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  steps: { flexDirection: 'row', gap: 28 },
  step: { width: 380, minHeight: 280, alignItems: 'center', gap: 10, padding: 26, borderRadius: 40, backgroundColor: sumo.panel, borderWidth: 4, borderColor: sumo.panelEdge },
  stepNumber: { width: 68, height: 68, borderRadius: 34, backgroundColor: sumo.gold, alignItems: 'center', justifyContent: 'center' },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  readyText: { marginLeft: 12 },
  tick: { position: 'absolute', right: -6, bottom: -6, width: 34, height: 34, borderRadius: 17, backgroundColor: sumo.you, alignItems: 'center', justifyContent: 'center' },
  crownRing: { padding: 10, borderRadius: 999, borderWidth: 10, borderColor: sumo.gold },
  board: { width: 1100, gap: 10 },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 24, paddingHorizontal: 28, paddingVertical: 8, borderRadius: 999, backgroundColor: sumo.panel },
  boardLeader: { borderWidth: 4, borderColor: sumo.gold },
  boardName: { flex: 1 },
});
