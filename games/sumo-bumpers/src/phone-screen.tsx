import type { GamePlayer, PhoneGameScreenProps } from '@huddle/domain';
import { AvatarPortrait, useCountdownSeconds } from '@huddle/ui/game-kit';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { FRICTION, MAX_SPEED, PUCK_SPEED } from './sim';
import { BLOB_RADIUS, KNOCKOUT_POINTS, SURVIVE_POINTS, WIN_POINTS } from './logic';
import { beatKey, HOW_TO_STEPS, knockoutLine, phaseSeconds } from './presentation';
import { SumoText as Text } from './text';
import { sumo } from './theme';
import type { Aim, SumoEvent, SumoState } from './types';

const PAD = 300;
const UNIT = 130;
const MAX_DRAG = 110;
const DOTS = 9;

export function SumoBumpersPhoneScreen({
  state,
  player,
  players = [],
  sendEvent,
  safeAreaInsets,
  hostChromeInsetBottom,
  clockRemainingMs,
  isHost = false,
  feedback,
  hostNickname,
}: PhoneGameScreenProps<SumoState, SumoEvent>) {
  const me = player.playerId;
  const playing = state.standings.some((standing) => standing.playerId === me);
  const seconds = useCountdownSeconds(state.phase === 'finished' ? 0 : clockRemainingMs, phaseSeconds(state), beatKey(state));
  const insets = { top: safeAreaInsets?.top ?? 0, bottom: (safeAreaInsets?.bottom ?? 0) + (hostChromeInsetBottom ?? 0) };
  const ghost = state.blobs[me]?.alive === false;
  const knockedOutNow = state.phase === 'replay' && state.lastRound?.knockedOut.includes(me) === true;

  useEffect(() => {
    if (state.phase !== 'replay' || !playing) return;
    feedback?.(knockedOutNow ? 'error' : 'success');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.round, state.match]);

  if (!playing) {
    return (
      <Screen insets={insets}>
        <Text size={28} weight="black">Sumo Bumpers is on</Text>
        <Text size={18} color={sumo.muted}>You’re in from the next game. Watch the ice on the TV!</Text>
      </Screen>
    );
  }

  if (state.phase === 'howTo') {
    const tapped = (state.gotIt ?? []).includes(me);
    return (
      <Screen insets={insets}>
        <Text size={16} color={sumo.gold} tracking={3} weight="bold">HOW TO PLAY</Text>
        <Text size={34} weight="black">Sumo Bumpers</Text>
        <View style={styles.rules}>
          {HOW_TO_STEPS.map((step, index) => (
            <View key={step.title} style={styles.rule}>
              <View style={styles.ruleNumber}><Text size={18} weight="black" color={sumo.ink}>{String(index + 1)}</Text></View>
              <View style={styles.flex}>
                <Text size={20} weight="black" align="left">{step.title}</Text>
                <Text size={15} color={sumo.muted} align="left">{step.line}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text size={15} color={sumo.muted}>{`Stay on +${SURVIVE_POINTS} · Bump someone off +${KNOCKOUT_POINTS} · Win the match +${WIN_POINTS}`}</Text>
        {tapped ? (
          <Text size={18} weight="bold" color={sumo.you}>{`Got it! Waiting for ${Math.max(0, state.standings.length - (state.gotIt?.length ?? 0))} more…`}</Text>
        ) : (
          <Button label="Got it" onPress={() => { feedback?.('select'); sendEvent({ kind: 'gotIt', playerId: me }); }} />
        )}
        {isHost ? (
          <Button label="Start now" variant="secondary" onPress={() => sendEvent({ kind: 'advance', playerId: me, match: 0, round: 0, phase: 'howTo' })} />
        ) : (
          <Text size={16} color={sumo.muted}>{`Starts when everyone taps Got it, or in ${seconds}s.`}</Text>
        )}
      </Screen>
    );
  }

  if (state.phase === 'aim') {
    return (
      <Screen insets={insets} scroll={false}>
        <View style={styles.header}>
          <Text size={16} color={sumo.muted} tracking={3}>{`MATCH ${state.match + 1} · ROUND ${state.round + 1}`}</Text>
          <View style={[styles.clock, seconds <= 3 ? styles.clockHot : null]}>
            <Text size={22} weight="black" color={seconds <= 3 ? sumo.ink : sumo.cream}>{`${seconds}s`}</Text>
          </View>
        </View>
        <Text size={24} weight="black">{ghost ? 'You’re a ghost! Fire a puck.' : 'Pull back to aim'}</Text>
        <Text size={15} color={sumo.muted}>{ghost ? 'Pull back from the edge. Your puck flies the other way.' : 'Let go to lock it in. Red line: you’d slide off.'}</Text>
        <AimPad
          key={`${state.match}:${state.round}`}
          state={state}
          me={me}
          players={players}
          ghost={ghost}
          locked={state.aims[me] && ghost ? { dx: -state.aims[me]!.dx, dy: -state.aims[me]!.dy } : state.aims[me]}
          onAim={(aim) => {
            feedback?.('select');
            const sent = ghost ? { dx: -aim.dx, dy: -aim.dy } : aim;
            sendEvent({ kind: 'aim', playerId: me, match: state.match, round: state.round, dx: sent.dx, dy: sent.dy });
          }}
        />
        <Text size={16} weight="bold" color={state.aims[me] ? sumo.you : sumo.muted}>
          {state.aims[me] ? 'Aim locked. You can still change it.' : 'No aim yet: you’ll stand still.'}
        </Text>
      </Screen>
    );
  }

  if (state.phase === 'replay') {
    const mine = state.lastRound?.knockouts.find((knockout) => knockout.by === me);
    return (
      <Screen insets={insets}>
        <Text size={16} color={sumo.muted} tracking={3}>{`MATCH ${state.match + 1} · ROUND ${state.round + 1}`}</Text>
        <Text size={44} weight="black" color={knockedOutNow ? sumo.hazard : ghost ? sumo.ghost : sumo.you}>
          {knockedOutNow ? 'Splash!' : ghost ? 'Boo!' : 'Still standing!'}
        </Text>
        <Text size={18} weight="bold">{mine ? knockoutLine(mine, players) : knockedOutNow ? 'You’re a ghost now. Get your revenge next round.' : 'Eyes on the TV!'}</Text>
        {isHost ? <Button label="Next round" onPress={() => sendEvent({ kind: 'advance', playerId: me, match: state.match, round: state.round, phase: 'replay' })} /> : null}
      </Screen>
    );
  }

  const ranked = [...state.standings].sort((a, b) => b.score - a.score);
  const mine = ranked.find((standing) => standing.playerId === me);
  const rank = ranked.findIndex((standing) => standing.score === mine?.score) + 1;
  if (state.phase === 'matchOver') {
    const won = state.matchWinners[state.matchWinners.length - 1] === me;
    return (
      <Screen insets={insets}>
        <Text size={16} color={sumo.muted} tracking={3}>{`MATCH ${state.match + 1} OF ${state.matchCount}`}</Text>
        <Text size={44} weight="black" color={won ? sumo.gold : sumo.cream}>{won ? 'You won the match!' : `#${rank} so far`}</Text>
        <Text size={22} weight="bold" color={sumo.gold}>{`${mine?.score ?? 0} points`}</Text>
        {isHost ? <Button label={state.match + 1 >= state.matchCount ? 'Show final scores' : 'Next match'} onPress={() => sendEvent({ kind: 'advance', playerId: me, match: state.match, round: state.round, phase: 'matchOver' })} /> : null}
      </Screen>
    );
  }

  return (
    <Screen insets={insets}>
      <Text size={16} color={sumo.muted} tracking={3}>GAME OVER</Text>
      <Text size={44} weight="black">{rank === 1 ? 'You won!' : `#${rank} of ${ranked.length}`}</Text>
      <Text size={22} weight="bold" color={sumo.gold}>{`${mine?.score ?? 0} points`}</Text>
      <Text size={16} color={sumo.muted}>{isHost ? 'Final scores are on the TV. Bring everyone back when you’re ready.' : `Final scores are on the TV. ${hostNickname ?? 'The host'} chooses what’s next.`}</Text>
    </Screen>
  );
}

function AimPad({
  state,
  me,
  players,
  ghost,
  locked,
  onAim,
}: {
  readonly state: SumoState;
  readonly me: string;
  readonly players: readonly GamePlayer[];
  readonly ghost: boolean;
  readonly locked?: Aim;
  readonly onAim: (aim: Aim) => void;
}) {
  const [drag, setDrag] = useState<Aim | undefined>(locked);
  const startRef = useRef<{ x: number; y: number } | undefined>(undefined);
  const lastRef = useRef<Aim | undefined>(undefined);
  const center = PAD / 2;
  const myBlob = state.blobs[me];
  const touch = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (event: GestureResponderEvent) => {
      startRef.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
    },
    onResponderMove: (event: GestureResponderEvent) => {
      const start = startRef.current;
      if (start === undefined) return;
      const dx = event.nativeEvent.pageX - start.x;
      const dy = event.nativeEvent.pageY - start.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const power = Math.min(1, length / MAX_DRAG);
      const next = length === 0 ? { dx: 0, dy: 0 } : { dx: (-dx / length) * power, dy: (-dy / length) * power };
      lastRef.current = next;
      setDrag(next);
    },
    onResponderRelease: () => {
      const last = lastRef.current;
      startRef.current = undefined;
      if (last !== undefined && (last.dx !== 0 || last.dy !== 0)) onAim(last);
    },
  };

  const aim = drag ?? { dx: 0, dy: 0 };
  const power = Math.sqrt(aim.dx * aim.dx + aim.dy * aim.dy);
  const radius = state.arenaRadius * UNIT;
  let origin = { x: 0, y: 0 };
  let reach = 0;
  let direction = { x: 0, y: 0 };
  if (power > 0) {
    if (ghost) {
      origin = { x: (-aim.dx / power) * state.arenaRadius, y: (-aim.dy / power) * state.arenaRadius };
      direction = { x: aim.dx / power, y: aim.dy / power };
      reach = (power * PUCK_SPEED) / FRICTION;
    } else if (myBlob) {
      origin = { x: myBlob.x, y: myBlob.y };
      direction = { x: aim.dx / power, y: aim.dy / power };
      reach = (power * MAX_SPEED) / FRICTION;
    }
  }
  const end = { x: origin.x + direction.x * reach, y: origin.y + direction.y * reach };
  const offIce = !ghost && power > 0 && end.x * end.x + end.y * end.y > state.arenaRadius * state.arenaRadius;
  const blobPx = BLOB_RADIUS * UNIT * 2;

  return (
    <View style={styles.pad} {...touch} accessible accessibilityRole="adjustable" accessibilityLabel={`Aim pad. Power ${Math.round(power * 100)} percent.`} testID="sumo-aim-pad">
      <View style={[styles.sea, { width: PAD, height: PAD, borderRadius: PAD / 2 }]} />
      <View style={[styles.padIce, { left: center - radius, top: center - radius, width: radius * 2, height: radius * 2, borderRadius: radius }]} />
      {Object.entries(state.blobs).map(([id, blob]) => {
        if (!blob.alive) return null;
        const who = players.find((candidate) => candidate.playerId === id);
        const mine = id === me;
        return (
          <View key={id} style={[styles.padBlob, { left: center + blob.x * UNIT - blobPx / 2, top: center + blob.y * UNIT - blobPx / 2, width: blobPx, height: blobPx, borderRadius: blobPx / 2 }, mine ? styles.padBlobMine : null]}>
            {who ? <AvatarPortrait avatarId={who.avatar} displayName={who.nickname} size={blobPx - 4} /> : null}
          </View>
        );
      })}
      {power > 0
        ? Array.from({ length: DOTS }, (_, index) => {
            const t = (index + 1) / DOTS;
            const x = center + (origin.x + (end.x - origin.x) * t) * UNIT;
            const y = center + (origin.y + (end.y - origin.y) * t) * UNIT;
            return <View key={index} style={[styles.dot, { left: x - 4, top: y - 4, backgroundColor: offIce ? sumo.hazard : ghost ? sumo.ghost : sumo.you }]} />;
          })
        : null}
      {ghost && power > 0 ? <View style={[styles.puckMark, { left: center + origin.x * UNIT - 10, top: center + origin.y * UNIT - 10 }]} /> : null}
      <View style={styles.powerBar}>
        <View style={[styles.powerFill, { width: `${Math.round(power * 100)}%`, backgroundColor: offIce ? sumo.hazard : sumo.gold }]} />
      </View>
    </View>
  );
}

function Button({ label, onPress, variant = 'primary' }: { readonly label: string; readonly onPress: () => void; readonly variant?: 'primary' | 'secondary' }) {
  const secondary = variant === 'secondary';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={secondary ? 'sumo-next-secondary' : 'sumo-next'}
      style={({ pressed }) => [styles.button, secondary ? styles.buttonSecondary : null, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <Text size={20} weight="black" color={secondary ? sumo.cream : sumo.ink}>{label}</Text>
    </Pressable>
  );
}

function Screen({ children, insets, scroll = true }: { readonly children: ReactNode; readonly insets: { readonly top: number; readonly bottom: number }; readonly scroll?: boolean }) {
  const content = [styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }];
  return (
    <View style={styles.screen} testID="sumo-phone-screen">
      <StatusBar barStyle="light-content" backgroundColor={sumo.seaDeep} />
      {scroll ? <ScrollView contentContainerStyle={content}>{children}</ScrollView> : <View style={[styles.fill, content]}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sumo.seaDeep },
  fill: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, width: '100%', maxWidth: 480, alignSelf: 'center', alignItems: 'stretch', justifyContent: 'center', paddingHorizontal: 20, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clock: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 999, backgroundColor: sumo.panel },
  clockHot: { backgroundColor: sumo.gold },
  rules: { gap: 10 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 24, backgroundColor: sumo.panel },
  ruleNumber: { width: 40, height: 40, borderRadius: 20, backgroundColor: sumo.gold, alignItems: 'center', justifyContent: 'center' },
  pad: { width: PAD, height: PAD + 28, alignSelf: 'center' },
  sea: { position: 'absolute', left: 0, top: 0, backgroundColor: sumo.sea },
  padIce: { position: 'absolute', backgroundColor: sumo.ice, borderWidth: 4, borderColor: sumo.hazard },
  padBlob: { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: sumo.cream, borderWidth: 2, borderColor: sumo.ink },
  padBlobMine: { borderWidth: 3, borderColor: sumo.you },
  dot: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  puckMark: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: sumo.ghost, borderWidth: 3, borderColor: sumo.cream },
  powerBar: { position: 'absolute', left: 40, right: 40, bottom: 0, height: 12, borderRadius: 6, backgroundColor: sumo.panel, overflow: 'hidden' },
  powerFill: { height: 12, borderRadius: 6 },
  button: { minHeight: 56, borderRadius: 999, backgroundColor: sumo.gold, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 3, borderColor: sumo.panelEdge },
});
