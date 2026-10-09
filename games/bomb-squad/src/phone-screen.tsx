import type { PhoneGameScreenProps } from '@huddle/domain';
import { HuddleText } from '@huddle/ui/game-kit';
import { useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, View, type TextStyle } from 'react-native';

import { BRIEF_SECONDS, DEFUSE_POINTS, HOW_TO_SECONDS, REVEAL_SECONDS, SABOTAGE_POINTS } from './logic';
import { clueText, useCountdownSeconds, WIRE_COLOR, wireName } from './presentation';
import { bomb, FONT } from './theme';
import { type BombEvent, type BombState, type Wire, WIRES } from './types';

/** The phone: your secret, and your vote. Nothing here is shown on the TV. */
export function BombSquadPhoneScreen({
  state,
  player,
  sendEvent,
  safeAreaInsets,
  hostChromeInsetBottom,
  clockRemainingMs,
  isHost = false,
  feedback,
  hostNickname,
}: PhoneGameScreenProps<BombState, BombEvent>) {
  const me = player.playerId;
  const playing = state.standings.some((standing) => standing.playerId === me);
  const deal = state.rounds[state.round];
  const clue = deal?.clues[me];
  const saboteur = deal?.saboteurs.includes(me) === true;
  const myVote = state.votes[me];
  const result = state.phase === 'reveal' ? state.results[state.round] : undefined;
  const fallback = state.phase === 'howTo' ? HOW_TO_SECONDS : state.phase === 'brief' ? BRIEF_SECONDS : state.phase === 'debate' ? state.debateSeconds : REVEAL_SECONDS;
  const seconds = useCountdownSeconds(state.phase === 'finished' ? 0 : clockRemainingMs, fallback, `${state.round}:${state.phase}`);
  const insets = { top: safeAreaInsets?.top ?? 0, bottom: (safeAreaInsets?.bottom ?? 0) + (hostChromeInsetBottom ?? 0) };

  // One tap of feedback when this phone's own round result lands.
  const gain = result?.gains[me];
  const resultKey = result === undefined ? undefined : `${state.round}:${gain ?? 0}`;
  useEffect(() => {
    if (resultKey === undefined || !playing) return;
    feedback?.((gain ?? 0) > 0 ? 'success' : 'error');
    // Fires once per round's result; `feedback` identity is not a trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultKey]);

  if (!playing) {
    return (
      <Screen insets={insets}>
        <Text size={28} weight="black">Bomb Squad is on</Text>
        <Text size={18} color={bomb.muted}>{`Bomb ${state.round + 1} of ${state.roundCount}. You're in from the next game. Eyes on the TV!`}</Text>
      </Screen>
    );
  }

  if (state.phase === 'howTo') {
    return (
      <Screen insets={insets}>
        <Text size={16} color={bomb.hazard} tracking={3} weight="bold">HOW TO PLAY</Text>
        <Text size={34} weight="black">Bomb Squad</Text>
        <View style={styles.rules}>
          {[
            ['1', 'Read', 'Your secret clue appears here.'],
            ['2', 'Argue', 'Talk it out loud with the room.'],
            ['3', 'Cut', 'Tap the wire you think is safe.'],
          ].map(([number, title, line]) => (
            <View key={number} style={styles.rule}>
              <View style={styles.ruleNumber}><Text size={18} weight="black" color={bomb.night}>{number!}</Text></View>
              <View style={styles.ruleText}>
                <Text size={20} weight="black" align="left">{title!}</Text>
                <Text size={16} color={bomb.muted} align="left">{line!}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.twistCard}>
          <Text size={18} weight="black" color={bomb.night}>Someone’s clue is a lie.</Text>
          <Text size={15} weight="bold" color={bomb.night}>{`Defused: squad +${DEFUSE_POINTS}. Boom: saboteurs +${SABOTAGE_POINTS}.`}</Text>
        </View>
        {isHost ? (
          <Button label="Start the first bomb" onPress={() => sendEvent({ kind: 'advance', playerId: me, round: 0, phase: 'howTo' })} />
        ) : (
          <Text size={16} color={bomb.muted}>{`First bomb in ${seconds}s. ${hostNickname ?? 'The host'} can start sooner.`}</Text>
        )}
      </Screen>
    );
  }

  if (state.phase === 'finished') {
    const ranked = [...state.standings].sort((a, b) => b.score - a.score);
    const mine = ranked.find((standing) => standing.playerId === me);
    const rank = ranked.findIndex((standing) => standing.score === mine?.score) + 1;
    return (
      <Screen insets={insets}>
        <Text size={16} color={bomb.muted} tracking={3}>GAME OVER</Text>
        <Text size={44} weight="black">{rank === 1 ? 'You won!' : `#${rank} of ${ranked.length}`}</Text>
        <Text size={22} weight="bold" color={bomb.hazard}>{`${mine?.score ?? 0} points`}</Text>
        <Text size={16} color={bomb.muted}>
          {isHost ? 'Final scores are on the TV. Bring everyone back when you’re ready.' : `Final scores are on the TV. ${hostNickname ?? 'The host'} chooses what’s next.`}
        </Text>
      </Screen>
    );
  }

  if (state.phase === 'reveal' && result !== undefined) {
    const won = (gain ?? 0) > 0;
    return (
      <Screen insets={insets}>
        <Text size={16} color={bomb.muted} tracking={3}>{`BOMB ${state.round + 1} OF ${state.roundCount}`}</Text>
        <Text size={48} weight="black" color={result.defused ? bomb.safe : bomb.danger}>{result.defused ? 'Defused!' : 'Boom!'}</Text>
        <Text size={22} weight="bold">{won ? `+${gain} for you` : saboteur ? 'They saw through you.' : 'Nothing this time.'}</Text>
        <Text size={16} color={bomb.muted}>
          {`${state.round + 1 >= state.roundCount ? 'Final scores' : 'Next bomb'} in ${seconds}s. ${hostNickname ?? 'The host'} can move on sooner.`}
        </Text>
        {isHost ? (
          <Button
            label={state.round + 1 >= state.roundCount ? 'Show final scores' : 'Next bomb'}
            onPress={() => sendEvent({ kind: 'advance', playerId: me, round: state.round, phase: 'reveal' })}
          />
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen insets={insets}>
      <View style={styles.header}>
        <Text size={16} color={bomb.muted} tracking={3}>{`BOMB ${state.round + 1} OF ${state.roundCount}`}</Text>
        <View style={[styles.clock, seconds <= 10 && state.phase === 'debate' ? styles.clockHot : null]}>
          <Text size={22} weight="black" color={seconds <= 10 && state.phase === 'debate' ? bomb.night : bomb.cream}>{`${seconds}s`}</Text>
        </View>
      </View>
      <View style={[styles.role, saboteur ? styles.roleSaboteur : styles.roleDefuser]} accessible accessibilityLabel={`${saboteur ? 'You are a saboteur' : 'You are on the bomb squad'}. Your clue: ${clue ? clueText(clue) : 'none'}`}>
        <Text size={14} tracking={3} color={bomb.night} weight="black">{saboteur ? 'SABOTEUR' : 'BOMB SQUAD'}</Text>
        <Text size={26} weight="black" color={bomb.night}>{clue ? clueText(clue) : 'No clue this round.'}</Text>
        {saboteur && deal?.safe !== undefined ? (
          <Text size={16} weight="bold" color={bomb.night}>
            {`Secret: the safe wire is ${wireName(deal.safe)}. Get them to cut another.${deal.saboteurs.length > 1 ? ' You have a partner.' : ''}`}
          </Text>
        ) : (
          <Text size={16} color={bomb.night}>Your clue is true. Someone else’s isn’t.</Text>
        )}
      </View>
      {state.phase === 'brief' ? (
        <Text size={18} color={bomb.muted}>Read it, then argue it out loud. Cutting opens in a moment.</Text>
      ) : (
        <>
          <Text size={18} weight="bold">{myVote ? `You'd cut ${wireName(myVote)}. Change it until time runs out.` : 'Which wire do you cut?'}</Text>
          <View style={styles.wires}>
            {WIRES.map((wire) => (
              <WireButton
                key={wire}
                wire={wire}
                chosen={myVote === wire}
                onPress={() => {
                  feedback?.('select');
                  sendEvent({ kind: 'vote', playerId: me, round: state.round, wire });
                }}
              />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

function WireButton({ wire, chosen, onPress }: { readonly wire: Wire; readonly chosen: boolean; readonly onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Cut ${wire}`}
      accessibilityState={{ selected: chosen }}
      testID={`bomb-wire-${wire}`}
      style={({ pressed }) => [
        styles.wire,
        { backgroundColor: WIRE_COLOR[wire], transform: [{ scale: pressed ? 0.97 : 1 }] },
        chosen ? styles.wireChosen : null,
      ]}
    >
      <Text size={24} weight="black" color={bomb.night}>{chosen ? `✂ ${wireName(wire)}` : wireName(wire)}</Text>
    </Pressable>
  );
}

function Button({ label, onPress }: { readonly label: string; readonly onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} testID="bomb-next" style={({ pressed }) => [styles.button, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
      <Text size={20} weight="black" color={bomb.night}>{label}</Text>
    </Pressable>
  );
}

function Screen({ children, insets }: { readonly children: ReactNode; readonly insets: { readonly top: number; readonly bottom: number } }) {
  return (
    <View style={styles.screen} testID="bomb-phone-screen">
      <StatusBar barStyle="light-content" backgroundColor={bomb.night} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>{children}</ScrollView>
    </View>
  );
}

function Text({
  children,
  size,
  weight = 'regular',
  color = bomb.cream,
  tracking,
  align = 'center',
}: {
  readonly children: ReactNode;
  readonly size: number;
  readonly weight?: keyof typeof FONT;
  readonly color?: string;
  readonly tracking?: number;
  readonly align?: 'center' | 'left';
}) {
  const style: TextStyle = { fontFamily: FONT[weight], fontSize: size, lineHeight: Math.round(size * 1.25), color, letterSpacing: tracking };
  return <HuddleText align={align} style={style}>{children}</HuddleText>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bomb.night },
  scroll: { flexGrow: 1, width: '100%', maxWidth: 480, alignSelf: 'center', alignItems: 'stretch', justifyContent: 'center', paddingHorizontal: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clock: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 999, backgroundColor: bomb.panel },
  clockHot: { backgroundColor: bomb.hazard },
  role: { borderRadius: 28, padding: 20, gap: 8 },
  roleDefuser: { backgroundColor: bomb.cream },
  roleSaboteur: { backgroundColor: bomb.danger },
  wires: { gap: 12, marginTop: 4 },
  wire: { minHeight: 64, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'transparent' },
  wireChosen: { borderColor: bomb.cream },
  rules: { gap: 12 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 24, backgroundColor: bomb.panel },
  ruleNumber: { width: 40, height: 40, borderRadius: 20, backgroundColor: bomb.hazard, alignItems: 'center', justifyContent: 'center' },
  ruleText: { flex: 1 },
  twistCard: { padding: 16, borderRadius: 24, backgroundColor: bomb.hazard, gap: 4 },
  button: { minHeight: 56, borderRadius: 999, backgroundColor: bomb.hazard, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
