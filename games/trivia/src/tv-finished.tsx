import { AvatarPortrait } from '@huddle/ui/game-kit';
import { StyleSheet, View } from 'react-native';

import { Confetti, cosmic, cosmicWash, CosmicText, Enter, Mascot, Pill, Twinkle } from './cosmic';
import { panel, SAFE_Y, STAGE_HEIGHT, STAGE_WIDTH, stageStyles } from './tv-stage';
import type { FinalStanding, WatchedScreen } from './watching';

const PODIUM_SLOT_WIDTH = 386;
const REST_SEAT_WIDTH = 236;

function WinnersCircle({ winners, reduceMotion }: { readonly winners: readonly FinalStanding[]; readonly reduceMotion: boolean | undefined }) {
  const size = winners.length > 6 ? 96 : 120;
  const score = winners[0]?.score ?? 0;
  const seat = size + 90;
  const columns = winners.length > 6 ? Math.ceil(winners.length / 2) : winners.length;
  return (
    <View style={styles.circle} testID="trivia-tv-winners-circle">
      <View style={[styles.circleRow, { width: columns * seat + (columns - 1) * 28 }]}>
        {winners.map((winner, index) => (
          <Enter key={winner.playerId} reduceMotion={reduceMotion} delay={250 + index * 60} scale={0.88} from={0} style={[styles.circleSeat, { width: seat }]} testID={`trivia-tv-final-row-${winner.playerId}`}>
            <View style={[styles.circleRing, { width: size + 20, height: size + 20, borderRadius: (size + 20) / 2 }]}>
              {winner.avatar ? <AvatarPortrait avatarId={winner.avatar} displayName={winner.nickname} size={size} disabled={winner.away} /> : null}
            </View>
            <CosmicText weight="extraBold" size={30} color={cosmic.cream} numberOfLines={1} style={{ maxWidth: seat }}>{winner.nickname}</CosmicText>
          </Enter>
        ))}
      </View>
      <Pill color={cosmic.butter} style={styles.circleScore}>
        <CosmicText weight="black" size={30}>{`${winners.length} winners · ${score} points each`}</CosmicText>
      </Pill>
      <Twinkle size={40} style={{ top: -10, left: 40 }} reduceMotion={reduceMotion} period={2600} />
      <Twinkle size={30} style={{ top: 40, right: 30 }} reduceMotion={reduceMotion} period={3300} />
    </View>
  );
}

const PODIUM_SLOTS = [2, 1, 3] as const;

const STEP_BY_RANK = {
  1: { color: cosmic.butter, height: 250, avatar: 150 },
  2: { color: cosmic.periwinkle, height: 205, avatar: 124 },
  3: { color: cosmic.coral, height: 185, avatar: 124 },
} as const;

function stepFor(rank: number) {
  return STEP_BY_RANK[Math.min(Math.max(rank, 1), 3) as 1 | 2 | 3];
}

export function FinishedStage({
  screen,
  reduceMotion,
}: {
  readonly screen: Extract<WatchedScreen, { kind: 'finished' }>;
  readonly reduceMotion: boolean | undefined;
}) {
  const winners = screen.standings.filter((standing) => standing.winner);
  const circle = winners.length > PODIUM_SLOTS.length;
  const top = circle ? [] : screen.standings.slice(0, 3);
  const rest = circle ? screen.standings.filter((standing) => !standing.winner) : screen.standings.slice(3);
  const byPlace = (place: number): FinalStanding | undefined => top[place - 1];
  const compactRest = rest.length > 4;
  const restColumns = compactRest ? Math.ceil(Math.min(rest.length, 7) / 2) : rest.length;

  return (
    <View style={StyleSheet.absoluteFill} accessible accessibilityRole="text" accessibilityLabel={finishedAccessibilityLabel(screen)}>
      <CosmicText weight="extraBold" size={40} color={cosmic.cream} tracking={7} align="center" style={stageStyles.topLabel}>
        FINAL SCORES
      </CosmicText>
      <Enter reduceMotion={reduceMotion} scale={0.85} from={0} style={styles.winnerPill}>
        <CosmicText weight="black" size={screen.headline.length > 24 ? 72 : 104} align="center" numberOfLines={1} adjustsFontSizeToFit>
          {screen.headline}
        </CosmicText>
      </Enter>
      {circle ? <WinnersCircle winners={winners} reduceMotion={reduceMotion} /> : null}
      <View style={styles.podium} testID="trivia-tv-final-grid">
        {circle ? null : PODIUM_SLOTS.map((place, index) => {
          const standing = byPlace(place);
          if (standing === undefined) return <View key={place} style={styles.podiumSlot} />;
          const { color, height, avatar } = stepFor(standing.rank);
          return (
            <Enter key={standing.playerId} reduceMotion={reduceMotion} delay={250 + index * 160} from={120} style={styles.podiumSlot} testID={`trivia-tv-final-row-${standing.playerId}`}>
              {standing.winner && standing.avatar ? (
                <>
                  <View style={[styles.winnerRing, { width: avatar + 28, height: avatar + 28, borderRadius: (avatar + 28) / 2, top: -14 }]} pointerEvents="none" />
                  <Twinkle size={40} style={{ top: -30, left: PODIUM_SLOT_WIDTH / 2 + avatar / 2 - 6 }} reduceMotion={reduceMotion} period={2600} />
                  <Twinkle size={30} style={{ top: avatar * 0.55, left: PODIUM_SLOT_WIDTH / 2 - avatar / 2 - 40 }} reduceMotion={reduceMotion} period={3300} />
                </>
              ) : null}
              {standing.avatar ? <AvatarPortrait avatarId={standing.avatar} displayName={standing.nickname} size={avatar} disabled={standing.away} /> : null}
              <View style={[styles.podiumBlock, { height, backgroundColor: color }]}>
                <View style={styles.podiumTop} pointerEvents="none" />
                <View style={styles.rankBadge}>
                  <CosmicText weight="black" size={40} style={{ lineHeight: 42 }}>{standing.rank}</CosmicText>
                </View>
                <CosmicText weight="black" size={40} numberOfLines={1} style={{ maxWidth: 340 }}>{standing.nickname}</CosmicText>
                <CosmicText weight="black" size={40}>{standing.score}</CosmicText>
              </View>
            </Enter>
          );
        })}
        {circle ? null : <View style={styles.podiumFloor} pointerEvents="none" />}
      </View>
      {rest.length > 0 ? (
        <Enter reduceMotion={reduceMotion} delay={800} style={styles.restDock}>
          <View style={[styles.restRow, compactRest ? { width: restColumns * REST_SEAT_WIDTH + (restColumns - 1) * 30 + 64 } : null]}>
          {rest.slice(0, 7).map((standing) => (
            <View key={standing.playerId} style={[styles.restSeat, compactRest ? styles.restSeatCompact : null]} testID={`trivia-tv-final-row-${standing.playerId}`}>
              <View style={styles.restRank}>
                <CosmicText weight="black" size={30} style={{ lineHeight: 34 }}>{standing.rank}</CosmicText>
              </View>
              {standing.avatar ? <AvatarPortrait avatarId={standing.avatar} displayName={standing.nickname} size={compactRest ? 48 : 64} disabled={standing.away} /> : null}
              <View style={compactRest ? styles.restText : null}>
                <CosmicText weight="bold" size={compactRest ? 24 : 30} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={compactRest ? null : { maxWidth: 240 }}>{standing.nickname}</CosmicText>
                <CosmicText weight="black" size={compactRest ? 24 : 30}>{standing.score}</CosmicText>
              </View>
            </View>
          ))}
          </View>
        </Enter>
      ) : null}
      <CosmicText weight="black" size={40} color={cosmic.cream} align="center" style={styles.thanks}>
        Thanks for playing together!
      </CosmicText>
      <Mascot pose="celebrate" width={220} reduceMotion={reduceMotion} style={stageStyles.revealMascot} />
      <Confetti width={STAGE_WIDTH} height={STAGE_HEIGHT} reduceMotion={reduceMotion} />
    </View>
  );
}

function finishedAccessibilityLabel(screen: Extract<WatchedScreen, { kind: 'finished' }>): string {
  const standings = screen.standings
    .map((standing) => `${standing.rank}. ${standing.nickname}, ${standing.score} points${standing.winner ? ', winner' : ''}`)
    .join('; ');
  return `${screen.headline}. Final Trivia standings: ${standings}.`;
}

const styles = StyleSheet.create({
  winnerPill: { ...panel, position: 'absolute', top: 150, left: 520, right: 520, paddingVertical: 22, paddingHorizontal: 40, alignItems: 'center' },
  podium: { position: 'absolute', left: 360, right: 360, bottom: 330, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 14 },
  podiumSlot: { width: PODIUM_SLOT_WIDTH, alignItems: 'center' },
  podiumBlock: { alignSelf: 'stretch', borderTopLeftRadius: 40, borderTopRightRadius: 40, alignItems: 'center', paddingTop: 16, marginTop: -16 },
  winnerRing: { position: 'absolute', alignSelf: 'center', borderWidth: 6, borderColor: cosmic.butter },
  podiumTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 22, borderTopLeftRadius: 40, borderTopRightRadius: 40, backgroundColor: cosmicWash.highlight },
  rankBadge: { width: 60, height: 60, borderRadius: 30, borderWidth: 4, borderColor: cosmic.navy, backgroundColor: cosmic.cream, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  restDock: { position: 'absolute', left: 200, right: 200, bottom: 186, alignItems: 'center' },
  podiumFloor: { position: 'absolute', left: -48, right: -48, bottom: -14, height: 14, borderRadius: 7, backgroundColor: cosmic.turquoise, opacity: 0.55 },
  restRow: { ...panel, maxWidth: '100%', minHeight: 100, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 30, rowGap: 10, paddingHorizontal: 32, paddingVertical: 14 },
  restSeat: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  restSeatCompact: { width: REST_SEAT_WIDTH, gap: 10 },
  restText: { flex: 1 },
  circle: { position: 'absolute', left: 200, right: 200, top: 330, bottom: 300, alignItems: 'center', justifyContent: 'center', gap: 30 },
  circleRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 28, rowGap: 18 },
  circleSeat: { alignItems: 'center', gap: 8 },
  circleRing: { borderWidth: 6, borderColor: cosmic.butter, alignItems: 'center', justifyContent: 'center' },
  circleScore: { paddingHorizontal: 30, paddingVertical: 8 },
  restRank: { width: 48, height: 48, borderRadius: 24, backgroundColor: cosmic.periwinkle, alignItems: 'center', justifyContent: 'center' },
  thanks: { position: 'absolute', left: 0, right: 0, bottom: SAFE_Y + 10 },
});
