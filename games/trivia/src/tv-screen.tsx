import type { TvGameScreenProps } from '@huddle/domain';
import { AvatarPortrait } from '@huddle/ui/game-kit';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';

import { TRIVIA_ART } from './art';
import {
  answerLetter,
  answerTone,
  CheckBadge,
  cosmic,
  CosmicText,
  CountdownRing,
  Confetti,
  CountUp,
  Enter,
  LaunchWipe,
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

/**
 * The night sky is the heaviest picture Trivia draws, and on a cold start it
 * decodes a beat after the stage mounts. Hold what sits on it until it has
 * loaded — never longer than `SKY_WAIT_MS`, so a slow device only waits briefly.
 */
const SKY_WAIT_MS = 600;

function useSkyFirst(): readonly [boolean, () => void] {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), SKY_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);
  return [shown, () => setShown(true)];
}

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
  const [skyShown, showStage] = useSkyFirst();
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
        <Image source={TRIVIA_ART.space} resizeMode="cover" style={styles.space} accessible={false} testID="trivia-tv-world" onLoad={showStage} />
        {/* With motion, the intro's launch wipe already covers the sky's load; without it, the stage waits for the sky. */}
        <View style={[StyleSheet.absoluteFill, { opacity: skyShown || reduceMotion === false ? 1 : 0 }]} testID="trivia-tv-stage-content">
          <Twinkle size={40} style={{ left: 40, top: 420 }} reduceMotion={reduceMotion} period={3400} />
          <Twinkle size={30} style={{ left: 1420, top: 330 }} reduceMotion={reduceMotion} period={4600} />
          <Twinkle size={34} style={{ right: 130, top: 520 }} reduceMotion={reduceMotion} period={3900} />
          <Twinkle size={26} style={{ left: 50, top: 760 }} reduceMotion={reduceMotion} period={5200} />
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
        <CosmicText weight="black" size={46} color={cosmic.cream} align="center">
          Answer on your phone. Watch the TV for the reveal.
        </CosmicText>
      </View>
      <View style={styles.crew}>
        <View style={styles.crewRule} />
        <View style={styles.crewLabel}>
          <CosmicText weight="extraBold" size={30} color={cosmic.cream} tracking={5}>YOUR CREW</CosmicText>
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
      <LaunchWipe width={STAGE_WIDTH} height={STAGE_HEIGHT} reduceMotion={reduceMotion} />
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
  // Names fit under the faces only for a smaller room; seats stay avatar-wide otherwise.
  const named = players.length <= 6;
  return (
    <View style={StyleSheet.absoluteFill} accessible accessibilityRole="text" accessibilityLabel={questionAccessibilityLabel(screen)}>
      <CosmicText weight="extraBold" size={36} color={cosmic.cream} tracking={7} align="center" style={styles.topLabel}>
        {`QUESTION ${screen.questionNumber} OF ${screen.questionCount}`}
      </CosmicText>
      <Pill style={styles.timer} testID="trivia-tv-clock">
        <CosmicText weight="black" size={64}>{timerLabel(screen.countdownSeconds)}</CosmicText>
      </Pill>
      <View style={styles.questionColumn}>
        {screen.category ? (
          <Pill color={cosmic.turquoise} style={styles.categoryChip} testID="trivia-tv-category">
            <CosmicText weight="black" size={28} tracking={3}>{screen.category.toUpperCase()}</CosmicText>
          </Pill>
        ) : null}
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
      <Mascot pose="idle" width={250} still reduceMotion={reduceMotion} style={[styles.peekingMascot, named ? styles.peekingMascotNamed : null]} />
      <View style={styles.footer}>
        <View style={styles.footerRule} />
        <View style={styles.footerRow}>
          <View style={styles.clockRow}>
            <CosmicText weight="black" size={56} color={cosmic.butter}>{screen.answered}</CosmicText>
            <CosmicText weight="bold" size={40} color={cosmic.cream}>{` of ${screen.playerCount} answered`}</CosmicText>
          </View>
          <View style={styles.footerAvatars}>
            {players.slice(0, 10).map((player) => (
              <View key={player.playerId} style={[styles.footerSeat, named ? styles.footerSeatNamed : null]}>
                <AvatarPortrait avatarId={player.avatar} displayName={player.nickname} size={players.length > 7 ? 60 : 72} disabled={player.away} />
                {named ? (
                  <CosmicText weight="bold" size={24} color={cosmic.cream} numberOfLines={1} style={styles.footerName}>{player.nickname}</CosmicText>
                ) : null}
              </View>
            ))}
          </View>
          <View style={styles.footerDivider} />
          <CosmicText weight="bold" size={40} color={cosmic.cream}>Answer on your phone</CosmicText>
        </View>
      </View>
    </View>
  );
}

/** A line for the room to laugh at when everybody, or nobody, got it. */
function tallyQuip(right: number, total: number): string | undefined {
  if (total < 2) return undefined;
  if (right === total) return 'Big brains all round!';
  if (right === 0) return 'Nobody saw that coming!';
  if (right === 1) return 'A lone genius walks among us.';
  return undefined;
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
  // Four or fewer rows would leave the panel mostly empty, so they read bigger.
  const roomy = screen.scoreboard.length <= 4;
  const gotIt = screen.verdicts.filter((verdict) => verdict.correct).length;
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
                <LetterBadge optionIndex={correct.optionIndex} size={72} />
                <CosmicText weight="black" size={correctAnswerSize(correct.text)} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.answerText}>
                  {correct.text}
                </CosmicText>
                <CheckBadge size={60} />
              </View>
            </Enter>
          ) : null}
          <Enter reduceMotion={reduceMotion} delay={700} from={10} style={styles.tally} testID="trivia-tv-tally">
            <View style={styles.tallyRow}>
              <CosmicText weight="black" size={64} color={cosmic.correct}>{gotIt}</CosmicText>
              <CosmicText weight="extraBold" size={34}>{` of ${screen.verdicts.length} got it right`}</CosmicText>
            </View>
            {tallyQuip(gotIt, screen.verdicts.length) ? (
              <CosmicText weight="bold" size={30} color={cosmic.muted} align="center">{tallyQuip(gotIt, screen.verdicts.length)}</CosmicText>
            ) : null}
          </Enter>
        </Enter>
        <Enter reduceMotion={reduceMotion} delay={120} style={styles.resultsPanel}>
          <CosmicText weight="black" size={66} align="center">Round results</CosmicText>
          <View style={[styles.resultRows, compact ? styles.resultRowsCompact : null, roomy ? styles.resultRowsRoomy : null]} testID="trivia-tv-verdict-grid">
            {screen.scoreboard.map((row, index) => {
              const right = verdictOf(row.playerId);
              return (
                <Enter key={row.playerId} reduceMotion={reduceMotion} delay={300 + index * 70} from={14} style={[styles.resultRow, compact ? styles.resultRowCompact : null]} testID={`trivia-tv-verdict-row-${row.playerId}`}>
                  {row.avatar ? <AvatarPortrait avatarId={row.avatar} displayName={row.nickname} size={compact ? 52 : roomy ? 84 : 66} disabled={row.away} /> : null}
                  <CosmicText weight="black" size={compact ? 30 : roomy ? 44 : 36} numberOfLines={1} style={styles.resultName}>{row.nickname}</CosmicText>
                  <View style={[styles.verdict, compact ? styles.verdictCompact : null, roomy ? styles.verdictRoomy : null]}>
                    {right ? <CheckBadge size={compact ? 38 : roomy ? 50 : 42} /> : <MissBadge size={compact ? 38 : roomy ? 50 : 42} />}
                    {compact ? null : (
                      <CosmicText weight="extraBold" size={roomy ? 36 : 32} color={right ? cosmic.correct : cosmic.missed}>
                        {right ? 'Correct' : 'Missed'}
                      </CosmicText>
                    )}
                  </View>
                  {row.gain !== undefined && row.gain > 0 && !compact ? (
                    <Enter reduceMotion={reduceMotion} delay={600 + index * 70} scale={0.5} from={0}>
                      <Pill color={cosmic.butter} style={styles.gainPill}>
                        <CosmicText weight="black" size={roomy ? 30 : 26}>{`+${row.gain}`}</CosmicText>
                      </Pill>
                    </Enter>
                  ) : null}
                  <CountUp
                    from={row.score - (row.gain ?? 0)}
                    to={row.score}
                    delay={650 + index * 70}
                    reduceMotion={reduceMotion}
                    weight="black"
                    size={compact ? 32 : roomy ? 46 : 38}
                    align="right"
                    style={compact ? styles.resultScoreCompact : styles.resultScore}
                  />
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

/** Width of one podium step. */
const PODIUM_SLOT_WIDTH = 386;

/** Left to right: the second, first and third finisher take these slots. */
const PODIUM_SLOTS = [2, 1, 3] as const;

/**
 * A step's look follows the rank, not the slot, so players who tie stand
 * equally high: a three-way tie for first is three gold steps.
 */
const STEP_BY_RANK = {
  1: { color: cosmic.butter, height: 250, avatar: 150 },
  2: { color: cosmic.periwinkle, height: 205, avatar: 124 },
  3: { color: cosmic.coral, height: 185, avatar: 124 },
} as const;

function stepFor(rank: number) {
  return STEP_BY_RANK[Math.min(Math.max(rank, 1), 3) as 1 | 2 | 3];
}

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
        {PODIUM_SLOTS.map((place, index) => {
          const standing = byPlace(place);
          if (standing === undefined) return <View key={place} style={styles.podiumSlot} />;
          const { color, height, avatar } = stepFor(standing.rank);
          return (
            <Enter key={standing.playerId} reduceMotion={reduceMotion} delay={250 + index * 160} from={120} style={styles.podiumSlot} testID={`trivia-tv-final-row-${standing.playerId}`}>
              {standing.winner && standing.avatar ? (
                // A gold ring and a sparkle for every winner; a tie shares the honour.
                <>
                  <View style={[styles.winnerRing, { width: avatar + 28, height: avatar + 28, borderRadius: (avatar + 28) / 2, top: -14 }]} pointerEvents="none" />
                  <Twinkle size={44} style={{ top: -30, left: PODIUM_SLOT_WIDTH / 2 + avatar / 2 - 6 }} reduceMotion={reduceMotion} period={2600} />
                  <Twinkle size={28} style={{ top: avatar * 0.55, left: PODIUM_SLOT_WIDTH / 2 - avatar / 2 - 40 }} reduceMotion={reduceMotion} period={3300} />
                </>
              ) : null}
              {standing.avatar ? <AvatarPortrait avatarId={standing.avatar} displayName={standing.nickname} size={avatar} disabled={standing.away} /> : null}
              <View style={[styles.podiumBlock, { height, backgroundColor: color }]}>
                <View style={styles.podiumTop} pointerEvents="none" />
                <View style={styles.rankBadge}>
                  <CosmicText weight="black" size={36} style={{ lineHeight: 42 }}>{standing.rank}</CosmicText>
                </View>
                {/* Badge, name and score must fit the shortest (3rd rank) step. */}
                <CosmicText weight="black" size={38} numberOfLines={1} style={{ maxWidth: 340 }}>{standing.nickname}</CosmicText>
                <CosmicText weight="black" size={38}>{standing.score}</CosmicText>
              </View>
            </Enter>
          );
        })}
      </View>
      {rest.length > 0 ? (
        <Enter reduceMotion={reduceMotion} delay={800} style={styles.restDock}>
          <View style={styles.restRow}>
          {rest.slice(0, 7).map((standing) => (
            <View key={standing.playerId} style={styles.restSeat} testID={`trivia-tv-final-row-${standing.playerId}`}>
              <View style={styles.restRank}>
                <CosmicText weight="black" size={28} style={{ lineHeight: 34 }}>{standing.rank}</CosmicText>
              </View>
              {standing.avatar ? <AvatarPortrait avatarId={standing.avatar} displayName={standing.nickname} size={rest.length > 4 ? 48 : 64} disabled={standing.away} /> : null}
              <View>
                <CosmicText weight="black" size={rest.length > 4 ? 24 : 30} numberOfLines={1} style={{ maxWidth: rest.length > 4 ? 140 : 240 }}>{standing.nickname}</CosmicText>
                <CosmicText weight="black" size={rest.length > 4 ? 24 : 30}>{standing.score}</CosmicText>
              </View>
            </View>
          ))}
          </View>
        </Enter>
      ) : null}
      <CosmicText weight="black" size={40} color={cosmic.cream} align="center" style={styles.thanks}>
        Thanks for playing together!
      </CosmicText>
      <Mascot pose="celebrate" width={220} reduceMotion={reduceMotion} style={styles.revealMascot} />
      <Confetti width={STAGE_WIDTH} height={STAGE_HEIGHT} reduceMotion={reduceMotion} />
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

/** The reveal tile has room for about 250px of text, so one word must never break mid-word. */
function correctAnswerSize(text: string): number {
  const longestWord = Math.max(...text.split(/\s+/).map((word) => word.length));
  if (text.length <= 7) return 54;
  if (longestWord <= 10 && text.length <= 16) return 40;
  // "Deoxyribonucleic" would split even at 34; Android only auto-shrinks past numberOfLines.
  if (longestWord > 12) return 28;
  return 34;
}

const styles = StyleSheet.create({
  viewport: { flex: 1, backgroundColor: cosmic.navy, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  space: { position: 'absolute', left: 0, top: 0, width: STAGE_WIDTH, height: STAGE_HEIGHT },
  stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT, overflow: 'hidden', backgroundColor: cosmic.navy },
  logo: { position: 'absolute', left: SAFE_X - 20, top: SAFE_Y - 10 },
  centered: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 240 },

  introColumn: { position: 'absolute', top: SAFE_Y + 16, bottom: 300, left: 300, right: 300, alignItems: 'center', justifyContent: 'space-between' },
  countPill: { paddingHorizontal: 44, paddingVertical: 12, marginBottom: 6 },
  introRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 48 },
  introClock: { alignItems: 'center' },
  crew: { position: 'absolute', left: SAFE_X, right: SAFE_X, bottom: SAFE_Y, alignItems: 'center' },
  crewRule: { position: 'absolute', top: 26, left: 0, right: 0, height: 2, backgroundColor: 'rgba(121,225,222,0.35)' },
  crewLabel: { paddingHorizontal: 36, paddingVertical: 8, borderRadius: 999, borderWidth: 3, borderColor: cosmic.turquoise, backgroundColor: cosmic.navy },
  crewRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 26, rowGap: 10, marginTop: 18 },
  crewSeat: { alignItems: 'center' },

  topLabel: { position: 'absolute', top: SAFE_Y + 18, left: 500, right: 500 },
  timer: { position: 'absolute', top: SAFE_Y + 4, right: SAFE_X + 60, paddingHorizontal: 34, paddingVertical: 8 },
  questionColumn: { position: 'absolute', top: 176, left: 340, right: 340, gap: 32 },
  categoryChip: { alignSelf: 'center', paddingHorizontal: 30, paddingVertical: 6, marginBottom: -46, zIndex: 1, borderWidth: 4, borderColor: cosmic.navy },
  questionPanel: { ...panel, minHeight: 230, paddingHorizontal: 70, paddingVertical: 34, alignItems: 'center', justifyContent: 'center' },
  answerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 32 },
  answerCell: { width: 604 },
  answerTile: { height: 148, borderRadius: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, gap: 30 },
  answerText: { flex: 1 },
  // Hands rest on the footer rule: it peeks over the edge rather than floating.
  peekingMascot: { position: 'absolute', right: 56, bottom: SAFE_Y + 96 },
  // Names under the faces make the footer row taller, so the rule sits higher.
  peekingMascotNamed: { bottom: SAFE_Y + 128 },
  footer: { position: 'absolute', left: SAFE_X, right: SAFE_X, bottom: SAFE_Y },
  footerRule: { height: 2, backgroundColor: 'rgba(121,225,222,0.35)', marginBottom: 24 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 30 },
  footerAvatars: { flexDirection: 'row', gap: 14, flex: 1, justifyContent: 'center' },
  footerSeat: { alignItems: 'center' },
  footerSeatNamed: { width: 128 },
  footerName: { marginTop: 2, maxWidth: 128 },
  footerDivider: { width: 2, height: 64, backgroundColor: 'rgba(255,248,235,0.4)' },

  revealRow: { position: 'absolute', top: 220, left: SAFE_X, right: SAFE_X, bottom: 200, flexDirection: 'row', gap: 40 },
  answerPanel: { ...panel, width: 560, paddingHorizontal: 44, paddingVertical: 48, alignItems: 'center' },
  correctTile: { borderRadius: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 22, gap: 20 },
  tally: { marginTop: 'auto', alignItems: 'center', gap: 4 },
  tallyRow: { flexDirection: 'row', alignItems: 'baseline' },
  resultsPanel: { ...panel, flex: 1, paddingHorizontal: 40, paddingTop: 36, paddingBottom: 28 },
  resultRows: { marginTop: 18, gap: 10 },
  resultRowsRoomy: { flex: 1, justifyContent: 'center', gap: 18, marginTop: 0 },
  resultRowsCompact: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, columnGap: 24 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(4,27,57,0.04)' },
  resultRowCompact: { width: 510, gap: 10, paddingVertical: 4 },
  resultName: { flex: 1 },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 12, width: 200 },
  verdictCompact: { width: 38 },
  verdictRoomy: { width: 250 },
  resultScore: { width: 110 },
  gainPill: { paddingHorizontal: 14, paddingVertical: 2 },
  resultScoreCompact: { width: 76 },
  nextBar: { position: 'absolute', left: 0, right: 0, bottom: SAFE_Y + 4, alignItems: 'center' },
  clockRow: { flexDirection: 'row', alignItems: 'baseline' },
  nextHint: { alignSelf: 'stretch', marginTop: 10 },
  nextPill: { paddingHorizontal: 52, paddingVertical: 12 },
  revealMascot: { position: 'absolute', right: 24, bottom: 8 },

  winnerPill: { ...panel, position: 'absolute', top: 150, left: 520, right: 520, paddingVertical: 22, paddingHorizontal: 40, alignItems: 'center' },
  podium: { position: 'absolute', left: 360, right: 360, bottom: 330, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 14 },
  podiumSlot: { width: PODIUM_SLOT_WIDTH, alignItems: 'center' },
  podiumBlock: { alignSelf: 'stretch', borderTopLeftRadius: 40, borderTopRightRadius: 40, alignItems: 'center', paddingTop: 16, marginTop: -16 },
  winnerRing: { position: 'absolute', alignSelf: 'center', borderWidth: 6, borderColor: cosmic.butter },
  // A lighter top face gives the flat steps some depth, like the pack's podium art.
  podiumTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 22, borderTopLeftRadius: 40, borderTopRightRadius: 40, backgroundColor: 'rgba(255,255,255,0.32)' },
  rankBadge: { width: 60, height: 60, borderRadius: 30, borderWidth: 4, borderColor: cosmic.navy, backgroundColor: cosmic.cream, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  // The panel hugs its seats, so one 4th place is a pill rather than an empty bar.
  restDock: { position: 'absolute', left: 200, right: 200, bottom: 132, alignItems: 'center' },
  restRow: { ...panel, maxWidth: '100%', minHeight: 100, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 30, rowGap: 10, paddingHorizontal: 32, paddingVertical: 14 },
  restSeat: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  restRank: { width: 48, height: 48, borderRadius: 24, backgroundColor: cosmic.periwinkle, alignItems: 'center', justifyContent: 'center' },
  thanks: { position: 'absolute', left: 0, right: 0, bottom: SAFE_Y + 10 },
});
