import type { TvGameScreenProps } from '@huddle/domain';
import { AvatarPortrait, useCountdownSeconds, useStageScale, useSystemReducedMotion } from '@huddle/ui/game-kit';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { TRIVIA_ART } from './art';
import {
  answerTone,
  cosmic,
  cosmicWash,
  CosmicText,
  CountdownRing,
  Enter,
  LaunchWipe,
  LetterBadge,
  Logo,
  Mascot,
  Pill,
  timerLabel,
  Twinkle,
} from './cosmic';
import { INTRO_SECONDS, QUESTION_SECONDS, REVEAL_SECONDS } from './state';
import type { TriviaState } from './types';
import { watchedScreen, type WatchedOption, type WatchedScreen } from './watching';
import { FinishedStage } from './tv-finished';
import { RevealStage } from './tv-reveal';
import { optionAccessibilityLabel, panel, type Players, SAFE_X, SAFE_Y, STAGE_HEIGHT, STAGE_WIDTH, stageStyles } from './tv-stage';

const SKY_WAIT_MS = 600;

function useSkyFirst(): readonly [boolean, () => void] {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), SKY_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);
  return [shown, () => setShown(true)];
}

export function TriviaTvScreen({ state, players, clockRemainingMs, hostNickname }: TvGameScreenProps<TriviaState>) {
  const scale = useStageScale();
  const reduceMotion = useSystemReducedMotion();
  const [skyShown, showStage] = useSkyFirst();
  const phase = state.phase;
  const beat = `${state.questionIndex}:${phase}`;
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
        <View style={[StyleSheet.absoluteFill, { opacity: skyShown || reduceMotion === false ? 1 : 0 }]} testID="trivia-tv-stage-content">
          <Twinkle size={40} style={{ left: 40, top: 420 }} reduceMotion={reduceMotion} period={3400} />
          <Twinkle size={30} style={{ left: 1420, top: 330 }} reduceMotion={reduceMotion} period={4600} />
          <Twinkle size={30} style={{ right: 130, top: 520 }} reduceMotion={reduceMotion} period={3900} />
          <Twinkle size={24} style={{ left: 50, top: 760 }} reduceMotion={reduceMotion} period={5200} />
          <View style={styles.logo} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Logo width={330} on="dark" />
          </View>
          {screen.kind === 'intro' ? (
            <IntroStage key="intro" screen={screen} players={players} seconds={seconds} reduceMotion={reduceMotion} />
          ) : null}
          {screen.kind === 'question' ? (
            <QuestionStage key={`q${screen.questionNumber}`} screen={screen} players={players} reduceMotion={reduceMotion} />
          ) : null}
          {screen.kind === 'reveal' ? (
            <RevealStage key={`r${screen.questionNumber}`} screen={screen} seconds={seconds} reduceMotion={reduceMotion} hostNickname={hostNickname} />
          ) : null}
          {screen.kind === 'finished' ? <FinishedStage key="finished" screen={screen} reduceMotion={reduceMotion} /> : null}
        </View>
      </View>
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
            <CosmicText weight="black" size={40} tracking={1}>{`${screen.questionCount} QUESTIONS`}</CosmicText>
          </Pill>
        </Enter>
        <Enter reduceMotion={reduceMotion} delay={80}>
          <CosmicText weight="black" size={124} color={cosmic.cream} align="center">Ready for liftoff?</CosmicText>
        </Enter>
        <View style={styles.introRow}>
          <Mascot pose="wave" width={420} reduceMotion={reduceMotion} />
          <Enter reduceMotion={reduceMotion} delay={200} scale={0.88} from={0} style={styles.introClock}>
            <CountdownRing seconds={seconds} size={250} />
            <CosmicText weight="extraBold" size={30} color={cosmic.cream} tracking={5} style={{ marginTop: 18 }}>
              FIRST QUESTION IN
            </CosmicText>
          </Enter>
        </View>
        <CosmicText weight="black" size={40} color={cosmic.cream} align="center">
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
              <CosmicText weight="black" size={players.length > 7 ? 24 : 30} color={cosmic.cream} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} align="center" style={{ marginTop: 6, alignSelf: 'stretch' }}>
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

function crewSeatWidth(count: number): number {
  return count > 7 ? 148 : 170;
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
  const named = players.length <= 6;
  const seatWidth = named ? Math.min(220, Math.floor((FOOTER_SEATS_WIDTH - 14 * (players.length - 1)) / Math.max(1, players.length))) : undefined;
  return (
    <View style={StyleSheet.absoluteFill} accessible accessibilityRole="text" accessibilityLabel={questionAccessibilityLabel(screen)}>
      <CosmicText weight="extraBold" size={40} color={cosmic.cream} tracking={7} align="center" style={stageStyles.topLabel}>
        {`QUESTION ${screen.questionNumber} OF ${screen.questionCount}`}
      </CosmicText>
      <Pill style={styles.timer} testID="trivia-tv-clock">
        <CosmicText weight="black" size={64}>{timerLabel(screen.countdownSeconds)}</CosmicText>
      </Pill>
      <View style={styles.questionColumn}>
        {screen.category ? (
          <Pill color={cosmic.turquoise} style={styles.categoryChip} testID="trivia-tv-category">
            <CosmicText weight="black" size={30} tracking={3}>{screen.category.toUpperCase()}</CosmicText>
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
          <View style={stageStyles.clockRow}>
            <CosmicText weight="black" size={56} color={cosmic.butter}>{screen.answered}</CosmicText>
            <CosmicText weight="bold" size={40} color={cosmic.cream}>{` of ${screen.playerCount} answered`}</CosmicText>
          </View>
          <View style={styles.footerAvatars}>
            {players.slice(0, 10).map((player) => (
              <View key={player.playerId} style={[styles.footerSeat, seatWidth === undefined ? null : { width: seatWidth }]}>
                <AvatarPortrait avatarId={player.avatar} displayName={player.nickname} size={players.length > 7 ? 56 : 72} disabled={player.away} />
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

function questionSize(text: string): number {
  if (text.length > 90) return 52;
  if (text.length > 55) return 60;
  return 74;
}

function AnswerTile({ option }: { readonly option: WatchedOption }) {
  return (
    <View style={[styles.answerTile, { backgroundColor: answerTone(option.optionIndex) }]}>
      <LetterBadge optionIndex={option.optionIndex} size={82} />
      <CosmicText weight="black" size={option.text.length > 24 ? 40 : 56} numberOfLines={2} style={stageStyles.answerText}>
        {option.text}
      </CosmicText>
    </View>
  );
}

function questionAccessibilityLabel(screen: Extract<WatchedScreen, { kind: 'question' }>): string {
  const choices = screen.options.map((option) => optionAccessibilityLabel(option, false)).join('; ');
  return `Question ${screen.questionNumber} of ${screen.questionCount}. ${screen.text}. Choices: ${choices}. ${screen.answered} of ${screen.playerCount} answered. ${screen.countdownSeconds} seconds remaining.`;
}

const FOOTER_SEATS_WIDTH = 900;

const styles = StyleSheet.create({
  viewport: { flex: 1, backgroundColor: cosmic.navy, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  space: { position: 'absolute', left: 0, top: 0, width: STAGE_WIDTH, height: STAGE_HEIGHT },
  stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT, overflow: 'hidden', backgroundColor: cosmic.navy },
  logo: { position: 'absolute', left: SAFE_X - 20, top: SAFE_Y - 10 },
  introColumn: { position: 'absolute', top: SAFE_Y + 16, bottom: 300, left: 300, right: 300, alignItems: 'center', justifyContent: 'space-between' },
  countPill: { paddingHorizontal: 44, paddingVertical: 12, marginBottom: 6 },
  introRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 48 },
  introClock: { alignItems: 'center' },
  crew: { position: 'absolute', left: SAFE_X, right: SAFE_X, bottom: SAFE_Y, alignItems: 'center' },
  crewRule: { position: 'absolute', top: 26, left: 0, right: 0, height: 2, backgroundColor: cosmicWash.rule },
  crewLabel: { paddingHorizontal: 36, paddingVertical: 8, borderRadius: 999, borderWidth: 3, borderColor: cosmic.turquoise, backgroundColor: cosmic.navy },
  crewRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 26, rowGap: 10, marginTop: 18 },
  crewSeat: { alignItems: 'center' },
  timer: { position: 'absolute', top: SAFE_Y + 4, right: SAFE_X + 60, paddingHorizontal: 34, paddingVertical: 8 },
  questionColumn: { position: 'absolute', top: 176, left: 340, right: 340, gap: 32 },
  categoryChip: { alignSelf: 'center', paddingHorizontal: 30, paddingVertical: 6, marginBottom: -46, zIndex: 1, borderWidth: 4, borderColor: cosmic.navy },
  questionPanel: { ...panel, minHeight: 230, paddingHorizontal: 70, paddingVertical: 34, alignItems: 'center', justifyContent: 'center' },
  answerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 32 },
  answerCell: { width: 604 },
  answerTile: { height: 148, borderRadius: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, gap: 30 },
  peekingMascot: { position: 'absolute', right: 56, bottom: SAFE_Y + 96 },
  peekingMascotNamed: { bottom: SAFE_Y + 128 },
  footer: { position: 'absolute', left: SAFE_X, right: SAFE_X, bottom: SAFE_Y },
  footerRule: { height: 2, backgroundColor: cosmicWash.rule, marginBottom: 24 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 30 },
  footerAvatars: { flexDirection: 'row', gap: 14, flex: 1, justifyContent: 'center' },
  footerSeat: { alignItems: 'center' },
  footerName: { marginTop: 2, maxWidth: '100%' },
  footerDivider: { width: 2, height: 64, backgroundColor: cosmicWash.divider },
});
