import type { GamePlayer, TvGameScreenProps } from '@huddle/domain';
import { AvatarPortrait, HuddleText } from '@huddle/ui/game-kit';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions, type TextStyle } from 'react-native';

import { CATCH_POINTS } from './logic';
import { phaseSeconds, useCountdownSeconds, useReducedMotion, WIRE_COLOR, wireName } from './presentation';
import { HowToDemo, useDemoBeat } from './how-to-demo';
import { HazardStripes, SkiaBomb, SkiaDefused, SkiaExplosion } from './skia-art';
import { bomb, FONT } from './theme';
import { type BombState, type Wire, WIRES } from './types';

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;

/** The TV: the bomb on its stage. Shows no secret until the room has cut a wire. */
export function BombSquadTvScreen({ state, players, clockRemainingMs, hostNickname }: TvGameScreenProps<BombState>) {
  const viewport = useWindowDimensions();
  const scale = Math.min(viewport.width / STAGE_WIDTH, viewport.height / STAGE_HEIGHT) || 1;
  const reduceMotion = useReducedMotion();
  const fallback = phaseSeconds(state);
  const seconds = useCountdownSeconds(state.phase === 'finished' ? 0 : clockRemainingMs, fallback, `${state.round}:${state.phase}`);
  const label = `BOMB ${Math.min(state.round + 1, state.roundCount)} OF ${state.roundCount}`;

  return (
    <View style={styles.viewport} pointerEvents="none" focusable={false} accessible={false} testID="bomb-tv-screen">
      <View style={[styles.stage, { transform: [{ scale }] }]}>
        <View style={styles.stripesTop}><HazardStripes width={STAGE_WIDTH} height={28} reduceMotion={reduceMotion} /></View>
        <View style={styles.stripesBottom}><HazardStripes width={STAGE_WIDTH} height={28} reduceMotion={reduceMotion} /></View>
        {state.phase === 'debate' && seconds <= 10 ? <DangerPulse reduceMotion={reduceMotion} /> : null}
        <Text size={30} color={bomb.muted} tracking={6} style={styles.label}>{state.phase === 'finished' ? 'FINAL SCORES' : state.phase === 'howTo' ? ' ' : label}</Text>
        {state.phase === 'howTo' ? <HowTo state={state} players={players} seconds={seconds} hostNickname={hostNickname} reduceMotion={reduceMotion} /> : null}
        {state.phase === 'brief' ? <Brief seconds={seconds} reduceMotion={reduceMotion} /> : null}
        {state.phase === 'debate' ? <Debate state={state} players={players} seconds={seconds} reduceMotion={reduceMotion} /> : null}
        {state.phase === 'cut' ? <Cut state={state} players={players} reduceMotion={reduceMotion} /> : null}
        {state.phase === 'accuse' ? <Accuse state={state} players={players} seconds={seconds} /> : null}
        {state.phase === 'reveal' ? <Reveal state={state} players={players} seconds={seconds} hostNickname={hostNickname} reduceMotion={reduceMotion} /> : null}
        {state.phase === 'finished' ? <Finished state={state} players={players} /> : null}
      </View>
    </View>
  );
}

function playingPlayers(state: BombState, players: readonly GamePlayer[]): GamePlayer[] {
  return players.filter((player) => state.standings.some((standing) => standing.playerId === player.playerId));
}

const HOW_TO_STEPS = [
  { title: 'Read', line: 'Your phone shows a secret clue about the safe wire.' },
  { title: 'Argue', line: 'Talk it out loud. Share your clue, or bend it.' },
  { title: 'Cut', line: 'Vote on your phone. The most-cut wire gets cut.' },
  { title: 'Accuse', line: 'Then name the liar. Catch them for points.' },
] as const;

/**
 * The rules, once, before the first bomb. With motion, an animated demo plays
 * the four steps with a caption for each; with reduced motion, the four steps
 * stand as cards. Starts when everyone taps "Got it" on their phone.
 */
function HowTo({
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
  const beat = useDemoBeat(reduceMotion);
  const saboteurs = state.standings.length >= 7 ? 'Two of you are saboteurs' : 'One of you is a saboteur';
  const playing = playingPlayers(state, players);
  const ready = state.gotIt ?? [];
  const step = HOW_TO_STEPS[beat] ?? HOW_TO_STEPS[0];
  return (
    <View
      style={styles.howTo}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`How to play Bomb Squad. ${HOW_TO_STEPS.map((item) => `${item.title}: ${item.line}`).join(' ')} ${saboteurs}, with a false clue. ${ready.length} of ${playing.length} are ready. Tap Got it on your phone.`}
    >
      <View style={styles.howToTitle}>
        <Text size={30} color={bomb.hazard} tracking={6} weight="bold">HOW TO PLAY</Text>
        <Text size={72} weight="black">Bomb Squad</Text>
      </View>
      {reduceMotion ? (
        <View style={styles.steps}>
          {HOW_TO_STEPS.map((item, index) => (
            <View key={item.title} style={styles.step}>
              <View style={styles.stepNumber}>
                <Text size={44} weight="black" color={bomb.night}>{String(index + 1)}</Text>
              </View>
              <Text size={52} weight="black">{item.title}</Text>
              <Text size={30} color={bomb.muted}>{item.line}</Text>
            </View>
          ))}
        </View>
      ) : (
        <>
          <HowToDemo beat={beat} />
          <View style={styles.caption}>
            <View style={styles.stepNumber}>
              <Text size={44} weight="black" color={bomb.night}>{String(beat + 1)}</Text>
            </View>
            <View>
              <Text size={52} weight="black" style={styles.captionText}>{step.title}</Text>
              <Text size={32} color={bomb.muted} style={styles.captionText}>{step.line}</Text>
            </View>
          </View>
        </>
      )}
      <View style={styles.twist}>
        <Text size={36} weight="black" color={bomb.night}>{`${saboteurs}. Their clue is a lie.`}</Text>
      </View>
      <View style={styles.readyRow}>
        {playing.map((player) => (
          <View key={player.playerId}>
            <AvatarPortrait avatarId={player.avatar} displayName={player.nickname} size={64} disabled={!ready.includes(player.playerId)} />
            {ready.includes(player.playerId) ? (
              <View style={styles.tick}>
                <Text size={24} weight="black" color={bomb.night}>✓</Text>
              </View>
            ) : null}
          </View>
        ))}
        <Text size={30} color={bomb.muted} style={styles.readyText}>
          {`${ready.length} of ${playing.length} ready · tap Got it on your phone · ${hostNickname ?? 'The host'} can start now · ${seconds}s`}
        </Text>
      </View>
    </View>
  );
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

/** The wire is cut: the blast or the defuse, and who voted for which wire. Nobody is unmasked yet. */
function Cut({ state, players, reduceMotion }: { readonly state: BombState; readonly players: readonly GamePlayer[]; readonly reduceMotion: boolean }) {
  const result = state.results[state.round];
  if (result === undefined) return null;
  const headline = result.defused ? 'DEFUSED!' : 'BOOM!';
  const cutLine =
    result.cut === null ? 'Nobody cut a wire.' : result.tied ? `A tie. The bomb picked ${wireName(result.cut)}.` : `You cut ${wireName(result.cut)}.`;
  return (
    <View style={styles.center} accessible accessibilityRole="text" accessibilityLabel={`${headline} ${cutLine} ${voteSummary(state, players)}`}>
      <View style={styles.revealArt}>
        {result.defused ? <SkiaDefused size={250} reduceMotion={reduceMotion} /> : <SkiaExplosion size={300} reduceMotion={reduceMotion} />}
      </View>
      <Pop reduceMotion={reduceMotion}>
        <Text size={120} weight="black" color={result.defused ? bomb.safe : bomb.danger}>{headline}</Text>
      </Pop>
      <Text size={48} weight="bold">{cutLine}</Text>
      <VoteBoard state={state} players={players} cut={result.cut} />
    </View>
  );
}

function voteSummary(state: BombState, players: readonly GamePlayer[]): string {
  return WIRES.map((wire) => {
    const names = players.filter((player) => state.votes[player.playerId] === wire).map((player) => player.nickname);
    return names.length === 0 ? '' : `${wireName(wire)}: ${names.join(', ')}.`;
  })
    .filter(Boolean)
    .join(' ');
}

/** Four columns, one per wire, with the faces of everyone who voted for it. */
function VoteBoard({ state, players, cut }: { readonly state: BombState; readonly players: readonly GamePlayer[]; readonly cut: Wire | null }) {
  const voters = playingPlayers(state, players);
  return (
    <View style={styles.voteBoard}>
      {WIRES.map((wire) => {
        const faces = voters.filter((player) => state.votes[player.playerId] === wire);
        return (
          <View key={wire} style={[styles.voteColumn, cut === wire ? { borderColor: WIRE_COLOR[wire] } : null]}>
            <View style={[styles.voteWire, { backgroundColor: WIRE_COLOR[wire] }]} />
            <Text size={32} weight="black" color={WIRE_COLOR[wire]}>{wireName(wire)}</Text>
            <View style={styles.voteFaces}>
              {faces.length === 0 ? <Text size={28} color={bomb.muted}>–</Text> : null}
              {faces.map((player) => (
                <AvatarPortrait key={player.playerId} avatarId={player.avatar} displayName={player.nickname} size={64} />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Accuse({ state, players, seconds }: { readonly state: BombState; readonly players: readonly GamePlayer[]; readonly seconds: number }) {
  const playing = playingPlayers(state, players);
  const accused = state.votedCount ?? 0;
  const saboteurs = state.standings.length >= 7 ? 'a saboteur' : 'the saboteur';
  return (
    <View style={styles.center} accessible accessibilityRole="text" accessibilityLabel={`Who lied? Name ${saboteurs} on your phone. ${seconds} seconds left. ${accused} of ${playing.length} have named someone.`}>
      <Text size={40} color={bomb.hazard} weight="bold" tracking={4}>WHO LIED?</Text>
      <View style={styles.accuseHead}>
        <Text size={88} weight="black">{`Name ${saboteurs}.`}</Text>
        <View style={[styles.timer, seconds <= 5 ? styles.timerHot : null]}>
          <Text size={80} weight="black" color={seconds <= 5 ? bomb.night : bomb.cream}>{String(seconds)}</Text>
        </View>
      </View>
      <Text size={32} color={bomb.muted}>Who voted for what? The liar wanted the wrong wire.</Text>
      <VoteBoard state={state} players={players} cut={state.results[state.round]?.cut ?? null} />
      <Text size={40} weight="bold">{`${accused} of ${playing.length} have named someone`}</Text>
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
  const catchers = playingPlayers(state, players).filter((player) => {
    const suspect = state.accusations[player.playerId];
    return !deal.saboteurs.includes(player.playerId) && suspect !== undefined && deal.saboteurs.includes(suspect);
  });
  const caughtLine = catchers.length === 0 ? 'Nobody named them.' : `Caught by ${catchers.map((player) => player.nickname).join(', ')}: +${CATCH_POINTS} each.`;
  return (
    <View
      style={styles.center}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${saboteurs.length === 1 ? 'The saboteur was' : 'The saboteurs were'} ${saboteurs.map((player) => player.nickname).join(' and ')}. The safe wire was ${deal.safe ?? 'hidden'}. ${caughtLine}`}
    >
      <Text size={40} color={bomb.muted} tracking={4}>{saboteurs.length === 1 ? 'THE SABOTEUR WAS' : 'THE SABOTEURS WERE'}</Text>
      <Pop reduceMotion={reduceMotion}>
        <View style={styles.saboteurRow}>
          {saboteurs.map((player) => (
            <View key={player.playerId} style={styles.saboteur}>
              <AvatarPortrait avatarId={player.avatar} displayName={player.nickname} size={180} />
              <Text size={56} weight="black" color={bomb.danger} numberOfLines={1}>{player.nickname}</Text>
              <Text size={36} weight="bold" color={(result.gains[player.playerId] ?? 0) > 0 ? bomb.hazard : bomb.muted}>
                {`+${result.gains[player.playerId] ?? 0}`}
              </Text>
            </View>
          ))}
        </View>
      </Pop>
      <Text size={44} weight="bold">
        {deal.safe === undefined ? '' : 'The safe wire was '}
        {deal.safe === undefined ? null : <Text size={44} weight="black" color={WIRE_COLOR[deal.safe]}>{wireName(deal.safe)}</Text>}
        {deal.safe === undefined ? '' : '.'}
      </Text>
      <Text size={40} weight="bold" color={catchers.length === 0 ? bomb.muted : bomb.safe}>{caughtLine}</Text>
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
  howTo: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  caption: { flexDirection: 'row', alignItems: 'center', gap: 24, minWidth: 900 },
  captionText: { textAlign: 'left' },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  readyText: { marginLeft: 12 },
  tick: { position: 'absolute', right: -6, bottom: -6, width: 34, height: 34, borderRadius: 17, backgroundColor: bomb.safe, alignItems: 'center', justifyContent: 'center' },
  howToTitle: { alignItems: 'flex-start' },
  steps: { flexDirection: 'row', gap: 32 },
  step: { width: 400, minHeight: 260, alignItems: 'center', gap: 10, padding: 28, borderRadius: 40, backgroundColor: bomb.panel, borderWidth: 4, borderColor: bomb.panelEdge },
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
  accuseHead: { flexDirection: 'row', alignItems: 'center', gap: 40 },
  voteBoard: { flexDirection: 'row', gap: 24, marginTop: 16 },
  voteColumn: { width: 360, minHeight: 220, alignItems: 'center', gap: 10, padding: 20, borderRadius: 32, backgroundColor: bomb.panel, borderWidth: 4, borderColor: bomb.panelEdge },
  voteWire: { width: 160, height: 16, borderRadius: 8 },
  voteFaces: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  board: { width: 1100, gap: 12, marginTop: 16 },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 24, paddingHorizontal: 28, paddingVertical: 8, borderRadius: 999, backgroundColor: bomb.panel },
  boardWinner: { borderWidth: 4, borderColor: bomb.hazard },
  boardName: { flex: 1, textAlign: 'left' },
});
