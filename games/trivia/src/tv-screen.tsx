import type { TvGameScreenProps } from '@huddle/domain';
import { AvatarPortrait } from '@huddle/ui/game-kit';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';

import { TRIVIA_ART } from './art';
import {
  answerLetter,
  answerTone,
  CheckBadge,
  cosmic,
  CosmicText,
  CountdownRing,
  Enter,
  LetterBadge,
  Logo,
  Mascot,
  MissBadge,
  Pill,
  timerLabel,
  Twinkle,
  useCountdownSeconds,
  useReducedMotion,
} from './cosmic';
import { INTRO_SECONDS, QUESTION_SECONDS, REVEAL_SECONDS } from './state';
import type { TriviaState } from './types';
import { watchedScreen, type FinalStanding, type WatchedOption, type WatchedScreen } from './watching';

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;
const SAFE_X = 96;
const SAFE_Y = 54;

type Players = TvGameScreenProps<TriviaState>['players'];

/**
 * Trivia's shared living-room stage: Cosmic Quiz on a night sky.
 *
 * Display-only. It imports no pressable, its root is not focusable, and it is
 * handed the room's redacted state: it shows the question, how many have
 * answered, the reveal and the scores — never who chose what. Answers happen
 * on the phones (`TriviaPhoneScreen`).
 */
export function TriviaTvScreen({ state, players, clockRemainingMs }: TvGameScreenProps<TriviaState>) {
  const viewport = useWindowDimensions();
  const scale = safeScale(viewport.width, viewport.height);
  const reduceMotion = useReducedMotion();
  const phase = state.phase;
  const beat = phase === 'entered' || !('questionIndex' in state) ? 'legacy' : `${state.questionIndex}:${phase}`;
  const seconds = useCountdownSeconds(
    phase === 'intro' || phase === 'question' || phase === 'reveal' ? clockRemainingMs : undefined,
    phase === 'intro'
      ? INTRO_SECONDS
      : phase === 'question'
        ? ('questionSeconds' in state ? state.questionSeconds : undefined) ?? QUESTION_SECONDS
        : phase === 'reveal'
          ? REVEAL_SECONDS
          : 0,
    beat,
  );
  const screen = watchedScreen(state, players, phase === 'question' ? seconds * 1000 : clockRemainingMs);

  return (
    <View style={styles.viewport} pointerEvents="none" focusable={false} accessible={false} testID="trivia-tv-screen">
      <View style={[styles.stage, { transform: [{ scale }] }]} pointerEvents="none" focusable={false}>
        <Image source={TRIVIA_ART.space} resizeMode="cover" style={styles.space} accessible={false} testID="trivia-tv-world" />
        <Twinkle size={40} style={{ left: 40, top: 420 }} />
        <Twinkle size={30} style={{ left: 1300, top: 230 }} />
        <Twinkle size={34} style={{ right: 130, top: 520 }} />
        <Twinkle size={26} style={{ left: 50, top: 760 }} />
        <View style={styles.logo} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Logo width={330} on="dark" />
        </View>
        {screen.kind === 'legacy' ? <LegacyStage questionCount={screen.questionCount} /> : null}
        {screen.kind === 'intro' ? (
          <IntroStage key="intro" screen={screen} players={players} seconds={seconds} reduceMotion={reduceMotion} />
        ) : null}
        {screen.kind === 'question' ? (
          <QuestionStage key={`q${screen.questionNumber}`} screen={screen} players={players} reduceMotion={reduceMotion} />
        ) : null}
        {screen.kind === 'reveal' ? (
          <RevealStage key={`r${screen.questionNumber}`} screen={screen} seconds={seconds} reduceMotion={reduceMotion} />
        ) : null}
        {screen.kind === 'finished' ? <FinishedStage key="finished" screen={screen} reduceMotion={reduceMotion} /> : null}
      </View>
    </View>
  );
}

function LegacyStage({ questionCount }: { readonly questionCount: 5 | 10 }) {
  return (
    <View
      style={styles.centered}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Trivia needs an update. This room was set up for ${questionCount} questions with an older version. Return to the room to start a new round.`}
    >
      <CosmicText weight="black" size={88} color={cosmic.cream} align="center">Room needs an update</CosmicText>
      <CosmicText size={40} color={cosmic.cream} align="center" style={{ marginTop: 24, maxWidth: 1200 }}>
        This room was set up for {questionCount} questions with an older version. Return to the room to start a new round.
      </CosmicText>
    </View>
  );
}

function IntroStage({
  screen,
  players,
  seconds,
  reduceMotion,
}: {
  readonly screen: Extract<WatchedScreen, { kind: 'intro' }>;
  readonly players: Players;
  readonly seconds: number;
  readonly reduceMotion: boolean | undefined;
}) {
  return (
    <View
      style={StyleSheet.absoluteFill}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Trivia countdown. Ready for liftoff? ${screen.questionCount} questions. First question in ${seconds} seconds. Answer on your phone; watch the TV for the reveal.`}
    >
      <View style={styles.introColumn}>
        <Enter reduceMotion={reduceMotion}>
          <Pill style={styles.countPill}>
            <CosmicText weight="black" size={38} tracking={1}>{`${screen.questionCount} QUESTIONS`}</CosmicText>
          </Pill>
        </Enter>
        <Enter reduceMotion={reduceMotion} delay={80}>
          <CosmicText weight="black" size={124} color={cosmic.cream} align="center">Ready for liftoff?</CosmicText>
        </Enter>
        <View style={styles.introRow}>
          <Mascot pose="wave" width={420} reduceMotion={reduceMotion} />
          <Enter reduceMotion={reduceMotion} delay={200} scale={0.6} from={0} style={styles.introClock}>
            <CountdownRing seconds={seconds} size={250} />
            <CosmicText weight="extraBold" size={30} color={cosmic.cream} tracking={5} style={{ marginTop: 18 }}>
              FIRST QUESTION IN
            </CosmicText>
          </Enter>
        </View>
        <CosmicText weight="black" size={46} color={cosmic.cream} align="center" style={{ marginTop: 10 }}>
          Answer on your phone. Watch the TV for the reveal.
        </CosmicText>
      </View>
      <View style={styles.crew}>
        <View style={styles.crewRule} />
        <View style={styles.crewLabel}>
          <CosmicText weight="extraBold" size={28} color={cosmic.cream} tracking={5}>YOUR CREW</CosmicText>
        </View>
        <View style={styles.crewRow} testID="trivia-tv-intro-avatars">
          {players.slice(0, 10).map((player, index) => (
            <Enter key={player.playerId} reduceMotion={reduceMotion} delay={300 + index * 60} style={[styles.crewSeat, { width: crewSeatWidth(players.length) }]}>
              <AvatarPortrait avatarId={player.avatar} displayName={player.nickname} size={players.length > 7 ? 92 : 112} disabled={player.away} />
              <CosmicText weight="black" size={players.length > 7 ? 26 : 30} color={cosmic.cream} numberOfLines={1} align="center" style={{ marginTop: 6, alignSelf: 'stretch' }}>
                {player.nickname}
              </CosmicText>
            </Enter>
          ))}
        </View>
      </View>
    </View>
  );
}

/** Ten seats and their gaps must fit the 1728-wide safe area. */
function crewSeatWidth(count: number): number {
  return count > 7 ? 140 : 170;
}

function QuestionStage({
  screen,
  players,
  reduceMotion,
}: {
  readonly screen: Extract<WatchedScreen, { kind: 'question' }>;
  readonly players: Players;
  readonly reduceMotion: boolean | undefined;
}) {
  return (
    <View style={StyleSheet.absoluteFill} accessible accessibilityRole="text" accessibilityLabel={questionAccessibilityLabel(screen)}>
      <CosmicText weight="extraBold" size={36} color={cosmic.cream} tracking={7} align="center" style={styles.topLabel}>
        {`QUESTION ${screen.questionNumber} OF ${screen.questionCount}`}
      </CosmicText>
      <Pill style={styles.timer} testID="trivia-tv-clock">
        <CosmicText weight="black" size={64}>{timerLabel(screen.countdownSeconds)}</CosmicText>
      </Pill>
      <View style={styles.questionColumn}>
        <Enter reduceMotion={reduceMotion} style={styles.questionPanel}>
          <CosmicText weight="black" size={questionSize(screen.text)} align="center" numberOfLines={3} adjustsFontSizeToFit>
            {screen.text}
          </CosmicText>
        </Enter>
        <View style={styles.answerGrid}>
          {screen.options.map((option, index) => (
            <Enter key={option.optionIndex} reduceMotion={reduceMotion} delay={150 + index * 70} style={styles.answerCell}>
              <AnswerTile option={option} />
            </Enter>
          ))}
        </View>
      </View>
      <Mascot pose="idle" width={250} reduceMotion={reduceMotion} style={styles.peekingMascot} />
      <View style={styles.footer}>
        <View style={styles.footerRule} />
        <View style={styles.footerRow}>
          <View style={styles.clockRow}>
            <CosmicText weight="black" size={56} color={cosmic.butter}>{screen.answered}</CosmicText>
            <CosmicText weight="bold" size={40} color={cosmic.cream}>{` of ${screen.playerCount} answered`}</CosmicText>
          </View>
          <View style={styles.footerAvatars}>
            {players.slice(0, 10).map((player) => (
              <AvatarPortrait key={player.playerId} avatarId={player.avatar} displayName={player.nickname} size={players.length > 7 ? 60 : 72} disabled={player.away} />
            ))}
          </View>
          <View style={styles.footerDivider} />
          <CosmicText weight="bold" size={40} color={cosmic.cream}>Answer on your phone</CosmicText>
        </View>
      </View>
    </View>
  );
}

/** Shorter questions read bigger; three lines of the longest still fit. */
function questionSize(text: string): number {
  if (text.length > 90) return 52;
  if (text.length > 55) return 60;
  return 74;
}

function AnswerTile({ option }: { readonly option: WatchedOption }) {
  return (
    <View style={[styles.answerTile, { backgroundColor: answerTone(option.optionIndex) }]}>
      <LetterBadge optionIndex={option.optionIndex} size={82} />
      <CosmicText weight="black" size={option.text.length > 22 ? 40 : 52} numberOfLines={2} style={styles.answerText}>
        {option.text}
      </CosmicText>
    </View>
  );
}

function RevealStage({
  screen,
  seconds,
  reduceMotion,
}: {
  readonly screen: Extract<WatchedScreen, { kind: 'reveal' }>;
  readonly seconds: number;
  readonly reduceMotion: boolean | undefined;
}) {
  const correct = screen.options.find((option) => option.correct === true);
  const last = screen.questionNumber >= screen.questionCount;
  const compact = screen.scoreboard.length > 5;
  const verdictOf = (playerId: string) => screen.verdicts.find((verdict) => verdict.playerId === playerId)?.correct === true;

  return (
    <View style={StyleSheet.absoluteFill} accessible accessibilityRole="text" accessibilityLabel={revealAccessibilityLabel(screen, seconds)}>
      <CosmicText weight="extraBold" size={36} color={cosmic.cream} tracking={7} align="center" style={styles.topLabel}>
        {`THE REVEAL • ${screen.questionNumber} / ${screen.questionCount}`}
      </CosmicText>
      <View style={styles.revealRow}>
        <Enter reduceMotion={reduceMotion} style={styles.answerPanel}>
          <CosmicText weight="black" size={58} align="center" numberOfLines={1}>Correct answer</CosmicText>
          <CosmicText weight="extraBold" size={40} align="center" numberOfLines={4} style={{ marginTop: 28 }}>
            {screen.text}
          </CosmicText>
          {correct ? (
            <Enter reduceMotion={reduceMotion} delay={350} scale={0.8} from={0} style={{ alignSelf: 'stretch', marginTop: 36 }}>
              <View style={[styles.correctTile, { backgroundColor: answerTone(correct.optionIndex) }]}>
                <LetterBadge optionIndex={correct.optionIndex} size={84} />
                <CosmicText weight="black" size={correct.text.length > 16 ? 40 : 54} numberOfLines={2} style={styles.answerText}>
                  {correct.text}
                </CosmicText>
                <CheckBadge size={76} />
              </View>
            </Enter>
          ) : null}
        </Enter>
        <Enter reduceMotion={reduceMotion} delay={120} style={styles.resultsPanel}>
          <CosmicText weight="black" size={66} align="center">Round results</CosmicText>
          <View style={[styles.resultRows, compact ? styles.resultRowsCompact : null]} testID="trivia-tv-verdict-grid">
            {screen.scoreboard.map((row, index) => {
              const right = verdictOf(row.playerId);
              return (
                <Enter key={row.playerId} reduceMotion={reduceMotion} delay={300 + index * 70} from={14} style={[styles.resultRow, compact ? styles.resultRowCompact : null]} testID={`trivia-tv-verdict-row-${row.playerId}`}>
                  {row.avatar ? <AvatarPortrait avatarId={row.avatar} displayName={row.nickname} size={compact ? 52 : 66} disabled={row.away} /> : null}
                  <CosmicText weight="black" size={compact ? 30 : 36} numberOfLines={1} style={styles.resultName}>{row.nickname}</CosmicText>
                  <View style={[styles.verdict, compact ? styles.verdictCompact : null]}>
                    {right ? <CheckBadge size={compact ? 34 : 42} /> : <MissBadge size={compact ? 34 : 42} />}
                    <CosmicText weight="extraBold" size={compact ? 26 : 32} color={right ? cosmic.correct : cosmic.missed}>
                      {right ? 'Correct' : 'Missed'}
                    </CosmicText>
                  </View>
                  <CosmicText weight="black" size={compact ? 32 : 38} align="right" style={compact ? styles.resultScoreCompact : styles.resultScore}>{row.score}</CosmicText>
                </Enter>
              );
            })}
          </View>
        </Enter>
      </View>
      <View style={styles.nextBar}>
        <Pill style={styles.nextPill}>
          <View style={styles.clockRow}>
            <CosmicText weight="extraBold" size={40}>{last ? 'Final scores in ' : 'Next question in '}</CosmicText>
            <CosmicText weight="black" size={52}>{`${seconds}s`}</CosmicText>
          </View>
        </Pill>
        <CosmicText weight="bold" size={32} color={cosmic.cream} align="center" style={styles.nextHint}>The host can move on sooner</CosmicText>
      </View>
      <Mascot pose="celebrate" width={220} reduceMotion={reduceMotion} style={styles.revealMascot} />
    </View>
  );
}

const PODIUM = [
  { place: 2, color: cosmic.periwinkle, height: 205 },
  { place: 1, color: cosmic.butter, height: 250 },
  { place: 3, color: cosmic.coral, height: 185 },
] as const;

function FinishedStage({
  screen,
  reduceMotion,
}: {
  readonly screen: Extract<WatchedScreen, { kind: 'finished' }>;
  readonly reduceMotion: boolean | undefined;
}) {
  const top = screen.standings.slice(0, 3);
  const rest = screen.standings.slice(3);
  const byPlace = (place: number): FinalStanding | undefined => top[place - 1];

  return (
    <View style={StyleSheet.absoluteFill} accessible accessibilityRole="text" accessibilityLabel={finishedAccessibilityLabel(screen)}>
      <CosmicText weight="extraBold" size={36} color={cosmic.cream} tracking={7} align="center" style={styles.topLabel}>
        FINAL SCORES
      </CosmicText>
      <Enter reduceMotion={reduceMotion} scale={0.85} from={0} style={styles.winnerPill}>
        <CosmicText weight="black" size={screen.headline.length > 18 ? 76 : 100} align="center" numberOfLines={1} adjustsFontSizeToFit>
          {screen.headline}
        </CosmicText>
      </Enter>
      <View style={styles.podium} testID="trivia-tv-final-grid">
        {PODIUM.map(({ place, color, height }, index) => {
          const standing = byPlace(place);
          if (standing === undefined) return <View key={place} style={styles.podiumSlot} />;
          return (
            <Enter key={standing.playerId} reduceMotion={reduceMotion} delay={250 + index * 160} from={120} style={styles.podiumSlot} testID={`trivia-tv-final-row-${standing.playerId}`}>
              {standing.avatar ? <AvatarPortrait avatarId={standing.avatar} displayName={standing.nickname} size={place === 1 ? 150 : 124} disabled={standing.away} /> : null}
              <View style={[styles.podiumBlock, { height, backgroundColor: color }]}>
                <View style={styles.rankBadge}>
                  <CosmicText weight="black" size={36} style={{ lineHeight: 42 }}>{standing.rank}</CosmicText>
                </View>
                {/* Badge, name and score must fit the shortest (3rd place) block. */}
                <CosmicText weight="black" size={38} numberOfLines={1} style={{ maxWidth: 340 }}>{standing.nickname}</CosmicText>
                <CosmicText weight="black" size={38}>{standing.score}</CosmicText>
              </View>
            </Enter>
          );
        })}
      </View>
      {rest.length > 0 ? (
        <Enter reduceMotion={reduceMotion} delay={800} style={styles.restRow}>
          {rest.slice(0, 7).map((standing) => (
            <View key={standing.playerId} style={styles.restSeat} testID={`trivia-tv-final-row-${standing.playerId}`}>
              <View style={styles.restRank}>
                <CosmicText weight="black" size={28} style={{ lineHeight: 34 }}>{standing.rank}</CosmicText>
              </View>
              {standing.avatar ? <AvatarPortrait avatarId={standing.avatar} displayName={standing.nickname} size={rest.length > 4 ? 48 : 64} disabled={standing.away} /> : null}
              <View>
                <CosmicText weight="black" size={rest.length > 4 ? 24 : 30} numberOfLines={1} style={{ maxWidth: 140 }}>{standing.nickname}</CosmicText>
                <CosmicText weight="black" size={rest.length > 4 ? 24 : 30}>{standing.score}</CosmicText>
              </View>
            </View>
          ))}
        </Enter>
      ) : null}
      <CosmicText weight="black" size={40} color={cosmic.cream} align="center" style={styles.thanks}>
        Thanks for playing together!
      </CosmicText>
      <Mascot pose="celebrate" width={220} reduceMotion={reduceMotion} style={styles.revealMascot} />
    </View>
  );
}

function optionAccessibilityLabel(option: WatchedOption, revealed: boolean): string {
  return `${answerLetter(option.optionIndex)}: ${option.text}${revealed && option.correct === true ? ', correct answer' : ''}`;
}

function questionAccessibilityLabel(screen: Extract<WatchedScreen, { kind: 'question' }>): string {
  const choices = screen.options.map((option) => optionAccessibilityLabel(option, false)).join('; ');
  return `Question ${screen.questionNumber} of ${screen.questionCount}. ${screen.text}. Choices: ${choices}. ${screen.answered} of ${screen.playerCount} answered. ${screen.countdownSeconds} seconds remaining.`;
}

function revealAccessibilityLabel(screen: Extract<WatchedScreen, { kind: 'reveal' }>, seconds: number): string {
  const choices = screen.options.map((option) => optionAccessibilityLabel(option, true)).join('; ');
  const results = screen.scoreboard
    .map((row) => {
      const verdict = screen.verdicts.find((candidate) => candidate.playerId === row.playerId);
      return `${row.nickname}, ${verdict?.correct ? 'Correct' : 'Missed'}, ${row.score} points`;
    })
    .join('; ');
  const next = screen.questionNumber >= screen.questionCount ? 'Final scores' : 'Next question';
  return `Reveal for question ${screen.questionNumber} of ${screen.questionCount}. ${screen.text}. Choices: ${choices}. Round results: ${results}. ${next} in ${seconds} seconds.`;
}

function finishedAccessibilityLabel(screen: Extract<WatchedScreen, { kind: 'finished' }>): string {
  const standings = screen.standings
    .map((standing) => `${standing.rank}. ${standing.nickname}, ${standing.score} points${standing.winner ? ', winner' : ''}`)
    .join('; ');
  return `${screen.headline}. Final Trivia standings: ${standings}.`;
}

function safeScale(width: number, height: number): number {
  const scale = Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

const panel = {
  backgroundColor: cosmic.cream,
  borderRadius: 56,
} as const;

const styles = StyleSheet.create({
  viewport: { flex: 1, backgroundColor: cosmic.navy, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  space: { position: 'absolute', left: 0, top: 0, width: STAGE_WIDTH, height: STAGE_HEIGHT },
  stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT, overflow: 'hidden', backgroundColor: cosmic.navy },
  logo: { position: 'absolute', left: SAFE_X - 20, top: SAFE_Y - 10 },
  centered: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 240 },

  introColumn: { position: 'absolute', top: SAFE_Y + 20, left: 300, right: 300, alignItems: 'center' },
  countPill: { paddingHorizontal: 44, paddingVertical: 12, marginBottom: 6 },
  introRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 40, marginTop: -6 },
  introClock: { alignItems: 'center' },
  crew: { position: 'absolute', left: SAFE_X, right: SAFE_X, bottom: SAFE_Y, alignItems: 'center' },
  crewRule: { position: 'absolute', top: 26, left: 0, right: 0, height: 2, backgroundColor: 'rgba(121,225,222,0.35)' },
  crewLabel: { paddingHorizontal: 36, paddingVertical: 8, borderRadius: 999, borderWidth: 3, borderColor: cosmic.turquoise, backgroundColor: cosmic.navy },
  crewRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 26, rowGap: 10, marginTop: 18 },
  crewSeat: { alignItems: 'center' },

  topLabel: { position: 'absolute', top: SAFE_Y + 18, left: 500, right: 500 },
  timer: { position: 'absolute', top: SAFE_Y + 4, right: SAFE_X + 60, paddingHorizontal: 34, paddingVertical: 8 },
  questionColumn: { position: 'absolute', top: 170, left: 340, right: 340, gap: 28 },
  questionPanel: { ...panel, minHeight: 230, paddingHorizontal: 70, paddingVertical: 34, alignItems: 'center', justifyContent: 'center' },
  answerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 26 },
  answerCell: { width: 607 },
  answerTile: { height: 128, borderRadius: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, gap: 30 },
  answerText: { flex: 1 },
  peekingMascot: { position: 'absolute', right: 50, bottom: 152 },
  footer: { position: 'absolute', left: SAFE_X, right: SAFE_X, bottom: SAFE_Y },
  footerRule: { height: 2, backgroundColor: 'rgba(121,225,222,0.35)', marginBottom: 24 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 30 },
  footerAvatars: { flexDirection: 'row', gap: 14, flex: 1, justifyContent: 'center' },
  footerDivider: { width: 2, height: 64, backgroundColor: 'rgba(255,248,235,0.4)' },

  revealRow: { position: 'absolute', top: 220, left: SAFE_X, right: SAFE_X, bottom: 200, flexDirection: 'row', gap: 40 },
  answerPanel: { ...panel, width: 560, paddingHorizontal: 44, paddingVertical: 48, alignItems: 'center' },
  correctTile: { borderRadius: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 26, paddingVertical: 22, gap: 24 },
  resultsPanel: { ...panel, flex: 1, paddingHorizontal: 40, paddingTop: 36, paddingBottom: 28 },
  resultRows: { marginTop: 18, gap: 10 },
  resultRowsCompact: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, columnGap: 24 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(4,27,57,0.04)' },
  resultRowCompact: { width: 510, gap: 10, paddingVertical: 4 },
  resultName: { flex: 1 },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 12, width: 200 },
  verdictCompact: { width: 150, gap: 8 },
  resultScore: { width: 110 },
  resultScoreCompact: { width: 76 },
  nextBar: { position: 'absolute', left: 0, right: 0, bottom: SAFE_Y + 4, alignItems: 'center' },
  clockRow: { flexDirection: 'row', alignItems: 'baseline' },
  nextHint: { alignSelf: 'stretch', marginTop: 10 },
  nextPill: { paddingHorizontal: 52, paddingVertical: 12 },
  revealMascot: { position: 'absolute', right: 24, bottom: 8 },

  winnerPill: { ...panel, position: 'absolute', top: 150, left: 520, right: 520, paddingVertical: 22, paddingHorizontal: 40, alignItems: 'center' },
  podium: { position: 'absolute', left: 380, right: 380, bottom: 330, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  podiumSlot: { width: 386, alignItems: 'center' },
  podiumBlock: { alignSelf: 'stretch', borderTopLeftRadius: 40, borderTopRightRadius: 40, alignItems: 'center', paddingTop: 16, marginTop: -16 },
  rankBadge: { width: 60, height: 60, borderRadius: 30, borderWidth: 4, borderColor: cosmic.navy, backgroundColor: cosmic.cream, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  restRow: { ...panel, position: 'absolute', left: 200, right: 200, bottom: 132, minHeight: 100, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 30, rowGap: 10, paddingHorizontal: 32, paddingVertical: 14 },
  restSeat: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  restRank: { width: 48, height: 48, borderRadius: 24, backgroundColor: cosmic.periwinkle, alignItems: 'center', justifyContent: 'center' },
  thanks: { position: 'absolute', left: 0, right: 0, bottom: SAFE_Y + 10 },
});
