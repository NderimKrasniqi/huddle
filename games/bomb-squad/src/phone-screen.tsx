import type { GamePlayer, PhoneGameScreenProps } from '@huddle/domain';
import { AvatarPortrait, useCountdownSeconds } from '@huddle/ui/game-kit';
import { useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';

import { CATCH_POINTS, DEFUSE_POINTS, SABOTAGE_POINTS } from './logic';
import { clueText, phaseSeconds, WIRE_COLOR, wireName } from './presentation';
import { bomb } from './theme';
import { BombText } from './text';
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
  players = [],
}: PhoneGameScreenProps<BombState, BombEvent>) {
  const me = player.playerId;
  const playing = state.standings.some((standing) => standing.playerId === me);
  const deal = state.rounds[state.round];
  const clue = deal?.clues[me];
  const saboteur = deal?.saboteurs.includes(me) === true;
  const myVote = state.votes[me];
  const result = state.phase === 'reveal' ? state.results[state.round] : undefined;
  const seconds = useCountdownSeconds(state.phase === 'finished' ? 0 : clockRemainingMs, phaseSeconds(state), `${state.round}:${state.phase}`);
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
        <BombText size={28} weight="black">Bomb Squad is on</BombText>
        <BombText size={18} color={bomb.muted}>{`Bomb ${state.round + 1} of ${state.roundCount}. You're in from the next game. Eyes on the TV!`}</BombText>
      </Screen>
    );
  }

  if (state.phase === 'howTo') {
    return (
      <Screen insets={insets}>
        <BombText size={16} color={bomb.hazard} tracking={3} weight="bold">HOW TO PLAY</BombText>
        <BombText size={34} weight="black">Bomb Squad</BombText>
        <View style={styles.rules}>
          {[
            ['1', 'Read', 'Your secret clue appears here.'],
            ['2', 'Argue', 'Talk it out loud with the room.'],
            ['3', 'Cut', 'Tap the wire you think is safe.'],
            ['4', 'Accuse', 'Then name the player who lied.'],
          ].map(([number, title, line]) => (
            <View key={number} style={styles.rule}>
              <View style={styles.ruleNumber}><BombText size={18} weight="black" color={bomb.night}>{number!}</BombText></View>
              <View style={styles.ruleText}>
                <BombText size={20} weight="black" align="left">{title!}</BombText>
                <BombText size={16} color={bomb.muted} align="left">{line!}</BombText>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.twistCard}>
          <BombText size={18} weight="black" color={bomb.night}>Someone’s clue is a lie.</BombText>
          <BombText size={15} weight="bold" color={bomb.night}>{`Defused: squad +${DEFUSE_POINTS}. Boom: saboteurs +${SABOTAGE_POINTS}. Catch the liar: +${CATCH_POINTS}.`}</BombText>
        </View>
        {(state.gotIt ?? []).includes(me) ? (
          <BombText size={18} weight="bold" color={bomb.safe}>
            {`Got it! Waiting for ${Math.max(0, state.standings.length - (state.gotIt?.length ?? 0))} more…`}
          </BombText>
        ) : (
          <Button
            label="Got it"
            onPress={() => {
              feedback?.('select');
              sendEvent({ kind: 'gotIt', playerId: me });
            }}
          />
        )}
        {isHost ? (
          <Button label="Start now" variant="secondary" onPress={() => sendEvent({ kind: 'advance', playerId: me, round: 0, phase: 'howTo' })} />
        ) : (
          <BombText size={16} color={bomb.muted}>{`Starts when everyone taps Got it, or in ${seconds}s.`}</BombText>
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
        <BombText size={16} color={bomb.muted} tracking={3}>GAME OVER</BombText>
        <BombText size={44} weight="black">{rank === 1 ? 'You won!' : `#${rank} of ${ranked.length}`}</BombText>
        <BombText size={22} weight="bold" color={bomb.hazard}>{`${mine?.score ?? 0} points`}</BombText>
        <BombText size={16} color={bomb.muted}>
          {isHost ? 'Final scores are on the TV. Bring everyone back when you’re ready.' : `Final scores are on the TV. ${hostNickname ?? 'The host'} chooses what’s next.`}
        </BombText>
      </Screen>
    );
  }

  const cutResult = state.results[state.round];
  if ((state.phase === 'cut' || state.phase === 'accuse') && cutResult !== undefined) {
    const others = players.filter((candidate) => candidate.playerId !== me && state.standings.some((standing) => standing.playerId === candidate.playerId));
    const suspect = state.accusations[me];
    return (
      <Screen insets={insets}>
        <View style={styles.header}>
          <BombText size={16} color={bomb.muted} tracking={3}>{`BOMB ${state.round + 1} OF ${state.roundCount}`}</BombText>
          {state.phase === 'accuse' ? (
            <View style={[styles.clock, seconds <= 5 ? styles.clockHot : null]}>
              <BombText size={22} weight="black" color={seconds <= 5 ? bomb.night : bomb.cream}>{`${seconds}s`}</BombText>
            </View>
          ) : null}
        </View>
        <BombText size={40} weight="black" color={cutResult.defused ? bomb.safe : bomb.danger}>{cutResult.defused ? 'Defused!' : 'Boom!'}</BombText>
        <BombText size={16} color={bomb.muted}>
          {[
            cutResult.cut === null ? 'Nobody cut a wire.' : cutResult.tied ? `A tie: the bomb picked ${wireName(cutResult.cut)}.` : `The room cut ${wireName(cutResult.cut)}.`,
            myVote ? `You voted ${wireName(myVote)}.` : 'You did not vote.',
          ].join(' ')}
        </BombText>
        {state.phase === 'cut' ? (
          <BombText size={20} weight="bold">Look at the TV: who voted for what?</BombText>
        ) : (
          <>
            <BombText size={22} weight="black">{saboteur ? 'Blend in. Who do you blame?' : 'Who lied?'}</BombText>
            <BombText size={15} color={bomb.muted}>{saboteur ? 'Most of the room missing you is worth points.' : `Name a saboteur: +${CATCH_POINTS}.`}</BombText>
            <View style={styles.suspects}>
              {others.map((candidate) => (
                <SuspectButton
                  key={candidate.playerId}
                  name={candidate.nickname}
                  avatar={candidate.avatar}
                  chosen={suspect === candidate.playerId}
                  onPress={() => {
                    feedback?.('select');
                    sendEvent({ kind: 'accuse', playerId: me, round: state.round, suspect: candidate.playerId });
                  }}
                />
              ))}
            </View>
          </>
        )}
        {isHost && state.phase === 'cut' ? (
          <Button label="Start accusing" onPress={() => sendEvent({ kind: 'advance', playerId: me, round: state.round, phase: 'cut' })} />
        ) : null}
      </Screen>
    );
  }

  if (state.phase === 'reveal' && result !== undefined) {
    const won = (gain ?? 0) > 0;
    const named = players.find((candidate) => candidate.playerId === state.accusations[me]);
    const liars = players.filter((candidate) => deal?.saboteurs.includes(candidate.playerId)).map((candidate) => candidate.nickname);
    return (
      <Screen insets={insets}>
        <BombText size={16} color={bomb.muted} tracking={3}>{liars.length === 1 ? 'THE SABOTEUR WAS' : 'THE SABOTEURS WERE'}</BombText>
        <BombText size={40} weight="black" color={bomb.danger}>{saboteur ? 'You!' : liars.join(' & ')}</BombText>
        <BombText size={22} weight="bold" color={won ? bomb.hazard : bomb.cream}>{won ? `+${gain} for you` : 'Nothing this time.'}</BombText>
        <BombText size={16} color={bomb.muted}>
          {[
            myVote ? `You voted ${wireName(myVote)}.` : 'You did not vote.',
            named ? `You named ${named.nickname}.` : 'You named nobody.',
          ].join(' ')}
        </BombText>
        <BombText size={16} color={bomb.muted}>
          {`${state.round + 1 >= state.roundCount ? 'Final scores' : 'Next bomb'} in ${seconds}s. ${hostNickname ?? 'The host'} can move on sooner.`}
        </BombText>
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
        <BombText size={16} color={bomb.muted} tracking={3}>{`BOMB ${state.round + 1} OF ${state.roundCount}`}</BombText>
        <View style={[styles.clock, seconds <= 10 && state.phase === 'debate' ? styles.clockHot : null]}>
          <BombText size={22} weight="black" color={seconds <= 10 && state.phase === 'debate' ? bomb.night : bomb.cream}>{`${seconds}s`}</BombText>
        </View>
      </View>
      <View style={[styles.role, saboteur ? styles.roleSaboteur : styles.roleDefuser]} accessible accessibilityLabel={`${saboteur ? 'You are a saboteur' : 'You are on the bomb squad'}. Your clue: ${clue ? clueText(clue) : 'none'}`}>
        <BombText size={14} tracking={3} color={bomb.night} weight="black">{saboteur ? 'SABOTEUR' : 'BOMB SQUAD'}</BombText>
        <BombText size={26} weight="black" color={bomb.night}>{clue ? clueText(clue) : 'No clue this round.'}</BombText>
        {saboteur && deal?.safe !== undefined ? (
          <BombText size={16} weight="bold" color={bomb.night}>
            {`Secret: the safe wire is ${wireName(deal.safe)}. Get them to cut another.${deal.saboteurs.length > 1 ? ' You have a partner.' : ''}`}
          </BombText>
        ) : (
          <BombText size={16} color={bomb.night}>Your clue is true. Someone else’s isn’t.</BombText>
        )}
      </View>
      {state.phase === 'brief' ? (
        <BombText size={18} color={bomb.muted}>Read it, then argue it out loud. Cutting opens in a moment.</BombText>
      ) : (
        <>
          <BombText size={18} weight="bold">{myVote ? `You'd cut ${wireName(myVote)}. Change it until time runs out.` : 'Which wire do you cut?'}</BombText>
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
      <BombText size={24} weight="black" color={bomb.night}>{chosen ? `✂ ${wireName(wire)}` : wireName(wire)}</BombText>
    </Pressable>
  );
}

function SuspectButton({ name, avatar, chosen, onPress }: { readonly name: string; readonly avatar: GamePlayer['avatar']; readonly chosen: boolean; readonly onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Name ${name}`}
      accessibilityState={{ selected: chosen }}
      style={({ pressed }) => [styles.suspect, chosen ? styles.suspectChosen : null, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <AvatarPortrait avatarId={avatar} displayName={name} size={44} />
      <View style={styles.ruleText}>
        <BombText size={20} weight="black" align="left" color={chosen ? bomb.night : bomb.cream}>{name}</BombText>
      </View>
      {chosen ? <BombText size={16} weight="black" color={bomb.night}>NAMED</BombText> : null}
    </Pressable>
  );
}

function Button({ label, onPress, variant = 'primary' }: { readonly label: string; readonly onPress: () => void; readonly variant?: 'primary' | 'secondary' }) {
  const secondary = variant === 'secondary';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={secondary ? 'bomb-next-secondary' : 'bomb-next'}
      style={({ pressed }) => [styles.button, secondary ? styles.buttonSecondary : null, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <BombText size={20} weight="black" color={secondary ? bomb.cream : bomb.night}>{label}</BombText>
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
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 3, borderColor: bomb.panelEdge },
  suspects: { gap: 10 },
  suspect: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, borderRadius: 999, backgroundColor: bomb.panel, borderWidth: 3, borderColor: bomb.panelEdge },
  suspectChosen: { backgroundColor: bomb.hazard, borderColor: bomb.cream },
  button: { minHeight: 56, borderRadius: 999, backgroundColor: bomb.hazard, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
