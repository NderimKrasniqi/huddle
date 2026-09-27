import type { TvGameScreenProps } from '@huddle/domain';
import { spacing } from '@huddle/design-tokens';
import {
  AvatarPortrait,
  HEARTBEAT_ARTWORK,
  HuddleText,
} from '@huddle/ui/native';
import {
  ImageBackground,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useEffect, useState } from 'react';

import { INTRO_SECONDS } from './state';
import { triviaOptionTones, triviaTvTheme } from './tv-theme';
import { watchedScreen, type WatchedOption, type WatchedScreen } from './watching';
import type { TriviaState } from './types';

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;
const OVERSCAN_X = 96;
const OVERSCAN_Y = 54;

/**
 * Trivia's shared living-room stage.
 *
 * This component is intentionally display-only: it imports no Pressable or
 * button primitive and its root is non-focusable. All private interaction is
 * rendered by `TriviaPhoneScreen`; the TV receives the redacted room state and
 * only presents prompts, neutral participation, reveals, and shared results.
 */
export function TriviaTvScreen({
  state,
  players,
  clockRemainingMs,
}: TvGameScreenProps<TriviaState>) {
  const viewport = useWindowDimensions();
  const scale = safeScale(viewport.width, viewport.height);
  const currentPhase = state.phase;
  const introCountdownSeconds = useCountdownSeconds(
    currentPhase === 'intro' ? clockRemainingMs : undefined,
    currentPhase === 'intro' ? INTRO_SECONDS : 0,
    currentPhase === 'entered' || !('questionIndex' in state) ? 'legacy-intro' : `${state.questionIndex}:intro`,
  );
  const countdownSeconds = useCountdownSeconds(
    currentPhase === 'question' ? clockRemainingMs : undefined,
    currentPhase === 'question' && 'questionSeconds' in state ? state.questionSeconds ?? 20 : 0,
    currentPhase === 'entered' || !('questionIndex' in state) ? 'legacy' : `${state.questionIndex}:${currentPhase}`,
  );
  const screen = watchedScreen(
    state,
    players,
    currentPhase === 'question' ? countdownSeconds * 1000 : clockRemainingMs,
  );

  return (
    <View
      style={styles.viewport}
      pointerEvents="none"
      focusable={false}
      accessible={false}
      testID="trivia-tv-screen"
    >
      <View style={[styles.stage, { transform: [{ scale }] }]} pointerEvents="none" focusable={false}>
        <ImageBackground
          source={HEARTBEAT_ARTWORK.gameWorlds.trivia}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          accessible={false}
          testID="trivia-tv-world"
        />
        <View style={styles.worldWash} pointerEvents="none" focusable={false} />
        <View style={styles.safeFrame} pointerEvents="none" focusable={false}>
          <View style={styles.stageLabel} pointerEvents="none" focusable={false} accessibilityElementsHidden>
            <View style={styles.stageLabelLeaf} />
            <HuddleText variant="caption" color="text" style={styles.stageLabelCopy}>TRIVIA · THE STORYBOOK QUIZ</HuddleText>
          </View>
          {screen.kind === 'legacy' ? <LegacyStage questionCount={screen.questionCount} /> : null}
          {screen.kind === 'intro' ? <IntroStage players={players} countdownSeconds={introCountdownSeconds} /> : null}
          {screen.kind === 'question' ? <QuestionStage screen={screen} players={players} /> : null}
          {screen.kind === 'reveal' ? <RevealStage screen={screen} /> : null}
          {screen.kind === 'finished' ? <FinishedStage screen={screen} /> : null}
        </View>
      </View>
    </View>
  );
}

function LegacyStage({ questionCount }: { readonly questionCount: 5 | 10 }) {
  return (
    <View style={styles.legacyBoard} accessible accessibilityRole="text" accessibilityLabel={`Trivia needs an update. Room needs an update. This launch-proof room was set for ${questionCount} questions. Return to the room to start a new round.`}>
      <TriviaTag label="TRIVIA" tone="muted" />
      <HuddleText variant="tvDisplay" color="text" align="center">Room needs an update</HuddleText>
      <HuddleText variant="bodyLarge" color="text" align="center">
        This launch-proof room was set for {questionCount} questions. Return to the room to start a new round.
      </HuddleText>
    </View>
  );
}

function IntroStage({
  players,
  countdownSeconds,
}: {
  readonly players: readonly TvGameScreenProps<TriviaState>['players'][number][];
  readonly countdownSeconds: number;
}) {
  return (
    <View style={styles.introStage} accessible accessibilityRole="text" accessibilityLabel={`Trivia countdown. Get ready. ${countdownSeconds} seconds remaining. Keep your eyes on the TV; answers happen on the phones.`}>
      <View style={styles.introLeaf} pointerEvents="none" focusable={false}>
        <View style={styles.introLeafStem} />
        <View style={styles.introLeafBud} />
      </View>
      <View style={styles.introBoard} pointerEvents="none" focusable={false}>
        <View style={styles.gameBrand} pointerEvents="none" focusable={false}>
          <View style={styles.brandMark} />
          <HuddleText variant="caption" color="text" style={styles.brandLabel}>TRIVIA / STORYBOOK QUIZ</HuddleText>
        </View>
        <HuddleText variant="tvDisplay" color="text" align="center">Get ready!</HuddleText>
        <View style={styles.countdownMark} pointerEvents="none" focusable={false}>
          <HuddleText variant="caption" color="text" align="center" style={styles.countdownLabel}>STARTING IN</HuddleText>
          <HuddleText variant="hero" color="text" align="center" style={styles.countdownNumber}>{countdownSeconds}</HuddleText>
        </View>
        <HuddleText variant="bodyLarge" color="text" align="center" style={styles.dimCopy}>
          Keep your eyes on the TV. Answers happen on the phones.
        </HuddleText>
      </View>
      <View style={styles.playerRibbon} pointerEvents="none" focusable={false}>
        <HuddleText variant="caption" color="text" style={styles.ribbonLabel}>AT THE TABLE</HuddleText>
        <PlayerAvatarStrip players={players} testID="trivia-tv-intro-avatars" />
      </View>
    </View>
  );
}

function QuestionStage({
  screen,
  players,
}: {
  readonly screen: Extract<WatchedScreen, { kind: 'question' }>;
  readonly players: readonly TvGameScreenProps<TriviaState>['players'][number][];
}) {
  return (
    <View style={styles.contentGrid} accessible accessibilityRole="text" accessibilityLabel={questionAccessibilityLabel(screen)}>
      <View style={styles.topRow} pointerEvents="none" focusable={false}>
        <View style={styles.headingCopy} pointerEvents="none" focusable={false}>
          <HuddleText variant="caption" color="text" style={styles.kicker}>QUESTION {screen.questionNumber} / {screen.questionCount}</HuddleText>
          <HuddleText variant="title" color="text">Think it through</HuddleText>
        </View>
        <View style={styles.timerPill}>
          <HuddleText variant="hero" color="text" accessibilityElementsHidden>{screen.countdownSeconds}</HuddleText>
          <HuddleText variant="caption" color="text" accessibilityElementsHidden>SECONDS</HuddleText>
        </View>
      </View>

      <View style={styles.questionPanel} pointerEvents="none" focusable={false}>
        <HuddleText variant="display" color="text" align="center">{screen.text}</HuddleText>
      </View>

      <View style={styles.optionGrid} pointerEvents="none" focusable={false}>
        {screen.options.map((option) => <TvOption key={option.optionIndex} option={option} />)}
      </View>

      <View style={styles.participationRow} pointerEvents="none" focusable={false}>
        <View style={styles.participationCopy} pointerEvents="none" focusable={false}>
          <TriviaTag label={`${screen.answered}/${screen.playerCount} answered`} tone={screen.answered === screen.playerCount ? 'ready' : 'paper'} />
          <HuddleText variant="body" color="text">Keep your eyes on the stage.</HuddleText>
        </View>
        <PlayerAvatarStrip players={players} testID="trivia-tv-answer-avatars" />
      </View>
    </View>
  );
}

function RevealStage({
  screen,
}: {
  readonly screen: Extract<WatchedScreen, { kind: 'reveal' }>;
}) {
  return (
    <View style={styles.contentGrid} accessible accessibilityRole="text" accessibilityLabel={revealAccessibilityLabel(screen)}>
      <View style={styles.topRow} pointerEvents="none" focusable={false}>
        <View style={styles.headingCopy} pointerEvents="none" focusable={false}>
          <HuddleText variant="caption" color="text" style={styles.kicker}>THE REVEAL · {screen.questionNumber}/{screen.questionCount}</HuddleText>
          <HuddleText variant="title" color="text">Here’s the answer</HuddleText>
        </View>
        <TriviaTag label="ANSWER REVEALED" tone="ready" />
      </View>

      <View style={styles.revealColumns} pointerEvents="none" focusable={false}>
        <View style={styles.revealQuestion}>
          <HuddleText variant="display" color="text" align="center">{screen.text}</HuddleText>
          <View style={styles.optionGrid}>
            {screen.options.map((option) => <TvOption key={option.optionIndex} option={option} revealed />)}
          </View>
        </View>
        <View style={styles.resultsPanel}>
          <View style={styles.resultsHeading} pointerEvents="none" focusable={false}>
            <HuddleText variant="title" color="text">Round results</HuddleText>
            <HuddleText variant="body" color="text" style={styles.dimCopy}>How the room did</HuddleText>
          </View>
          <View
            style={[styles.verdictList, screen.scoreboard.length >= 7 ? styles.verdictGrid : null]}
            testID="trivia-tv-verdict-grid"
          >
            {screen.scoreboard.map((row) => {
              const verdict = screen.verdicts.find((candidate) => candidate.playerId === row.playerId);
              return (
                <View
                  key={row.playerId}
                  testID={`trivia-tv-verdict-row-${row.playerId}`}
                  style={[styles.scoreRow, row.away ? styles.awayRow : null, screen.scoreboard.length >= 7 ? styles.scoreGridRow : null]}
                >
                  {row.avatar ? <AvatarPortrait avatarId={row.avatar} displayName={row.nickname} size={36} /> : <View style={[styles.avatarFallback, styles.scoreAvatarFallback]}><HuddleText variant="body" color="text">?</HuddleText></View>}
                  <View style={styles.scoreIdentity}>
                    <HuddleText variant="body" color="text" numberOfLines={1}>{row.nickname}</HuddleText>
                    <HuddleText variant="caption" color="text" style={styles.dimCopy}>{verdict?.correct ? 'Correct' : 'Missed'}</HuddleText>
                  </View>
                  <HuddleText variant="title" color="text">{row.score}</HuddleText>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

function FinishedStage({
  screen,
}: {
  readonly screen: Extract<WatchedScreen, { kind: 'finished' }>;
}) {
  return (
    <View style={styles.contentGrid} accessible accessibilityRole="text" accessibilityLabel={finishedAccessibilityLabel(screen)}>
      <View style={styles.finishedHeader} pointerEvents="none" focusable={false}>
        <View style={styles.gameBrand} pointerEvents="none" focusable={false}>
          <View style={styles.brandMark} />
          <HuddleText variant="caption" color="text" style={styles.brandLabel}>TRIVIA / LAST PAGE</HuddleText>
        </View>
        <HuddleText variant="tvDisplay" color="text" align="center">{screen.headline}</HuddleText>
        <HuddleText variant="bodyLarge" color="text" align="center">Thanks for playing together.</HuddleText>
      </View>
      <View
        style={[styles.finalList, screen.standings.length >= 7 ? styles.finalGrid : null]}
        pointerEvents="none"
        focusable={false}
        testID="trivia-tv-final-grid"
      >
        {screen.standings.map((standing) => (
          <View
            key={standing.playerId}
            testID={`trivia-tv-final-row-${standing.playerId}`}
            style={[
              styles.finalRow,
              standing.rank === 1 ? styles.firstPlaceRow : null,
              standing.rank === 2 ? styles.secondPlaceRow : null,
              standing.rank === 3 ? styles.thirdPlaceRow : null,
              standing.winner ? styles.winnerRow : null,
              screen.standings.length >= 7 ? styles.finalGridRow : null,
            ]}
          >
            <View style={styles.rankPill} pointerEvents="none" focusable={false}>
              <HuddleText variant="title" color="text">{standing.rank}</HuddleText>
            </View>
            {standing.avatar ? <AvatarPortrait avatarId={standing.avatar} displayName={standing.nickname} size={56} /> : <View style={styles.avatarFallback}><HuddleText variant="body" color="text">?</HuddleText></View>}
            <HuddleText variant="title" color="text" style={styles.finalName} numberOfLines={1}>{standing.nickname}</HuddleText>
            <HuddleText variant="hero" color="text">{standing.score}</HuddleText>
          </View>
        ))}
      </View>
    </View>
  );
}

function TvOption({ option, revealed = false }: { readonly option: WatchedOption; readonly revealed?: boolean }) {
  const correct = revealed && option.correct === true;
  return (
    <View style={[styles.option, { backgroundColor: triviaOptionTones[option.optionIndex % triviaOptionTones.length] }, correct ? styles.correctOption : null]} pointerEvents="none" focusable={false}>
      <View style={[styles.optionLetter, correct ? styles.correctLetter : null]}>
        <HuddleText variant="title" color="text" accessibilityElementsHidden>
          {String.fromCharCode(65 + option.optionIndex)}
        </HuddleText>
      </View>
      <HuddleText variant="bodyLarge" color="text" style={styles.optionCopy} numberOfLines={2}>
        {option.text}
      </HuddleText>
      {correct ? <TriviaTag label="Correct" tone="ready" /> : null}
    </View>
  );
}

function TriviaTag({ label, tone }: { readonly label: string; readonly tone: 'muted' | 'paper' | 'ready' }) {
  return (
    <View style={[styles.tag, tone === 'ready' ? styles.readyTag : tone === 'muted' ? styles.mutedTag : styles.paperTag]} pointerEvents="none" focusable={false}>
      <HuddleText variant="caption" color="text" style={styles.tagCopy}>{label}</HuddleText>
    </View>
  );
}

function PlayerAvatarStrip({
  players,
  testID,
}: {
  readonly players: TvGameScreenProps<TriviaState>['players'];
  readonly testID?: string;
}) {
  if (players.length === 0) return null;

  return (
    <View style={styles.avatarStrip} pointerEvents="none" focusable={false} testID={testID}>
      {players.slice(0, 10).map((player) => (
        <AvatarPortrait
          key={player.playerId}
          avatarId={player.avatar}
          displayName={player.nickname}
          size={48}
          disabled={player.away}
        />
      ))}
    </View>
  );
}

function optionAccessibilityLabel(option: WatchedOption, revealed: boolean): string {
  const letter = String.fromCharCode(65 + option.optionIndex);
  return `${letter}: ${option.text}${revealed && option.correct === true ? ', correct answer' : ''}`;
}

function questionAccessibilityLabel(screen: Extract<WatchedScreen, { kind: 'question' }>): string {
  const choices = screen.options.map((option) => optionAccessibilityLabel(option, false)).join('; ');
  return `Question ${screen.questionNumber} of ${screen.questionCount}. ${screen.text}. Choices: ${choices}. ${screen.answered} of ${screen.playerCount} answered. ${screen.countdownSeconds} seconds remaining.`;
}

function revealAccessibilityLabel(screen: Extract<WatchedScreen, { kind: 'reveal' }>): string {
  const choices = screen.options.map((option) => optionAccessibilityLabel(option, true)).join('; ');
  const results = screen.scoreboard.map((row) => {
    const verdict = screen.verdicts.find((candidate) => candidate.playerId === row.playerId);
    return `${row.nickname}, ${verdict?.correct ? 'Correct' : 'Missed'}, ${row.score} points`;
  }).join('; ');
  return `Reveal for question ${screen.questionNumber} of ${screen.questionCount}. ${screen.text}. Choices: ${choices}. Round results: ${results}.`;
}

function finishedAccessibilityLabel(screen: Extract<WatchedScreen, { kind: 'finished' }>): string {
  const standings = screen.standings.map((standing) => `${standing.rank}. ${standing.nickname}, ${standing.score} points${standing.winner ? ', winner' : ''}`).join('; ');
  return `${screen.headline}. Final Trivia standings: ${standings}.`;
}

function safeScale(width: number, height: number): number {
  const scale = Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

/** Locally animates only the shared display countdown; the server still advances the beat. */
function useCountdownSeconds(
  clockRemainingMs: number | undefined,
  fallbackSeconds: number,
  beat: string,
): number {
  const rawStartingMs = clockRemainingMs ?? fallbackSeconds * 1000;
  const startingMs = Number.isFinite(rawStartingMs)
    ? Math.max(0, rawStartingMs)
    : Math.max(0, fallbackSeconds * 1000);
  const initial = Math.max(0, Math.ceil(startingMs / 1000));
  const [display, setDisplay] = useState<{
    readonly beat: string;
    readonly startingMs: number;
    readonly seconds: number;
  }>({
    beat,
    startingMs,
    seconds: initial,
  });
  // Derive a new beat's first number synchronously; the effect cannot run
  // until after paint and must not let the prior question flash here.
  const seconds = display.beat === beat && display.startingMs === startingMs
    ? display.seconds
    : initial;

  useEffect(() => {
    const startedAt = Date.now();
    if (startingMs <= 0) return;

    const timer = setInterval(() => {
      const remainingMs = startingMs - (Date.now() - startedAt);
      if (remainingMs <= 0) {
        setDisplay({ beat, startingMs, seconds: 0 });
        clearInterval(timer);
        return;
      }
      setDisplay({ beat, startingMs, seconds: Math.ceil(remainingMs / 1000) });
    }, 250);

    return () => clearInterval(timer);
  }, [beat, startingMs]);

  return seconds;
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: triviaTvTheme.sage,
  },
  stage: {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    overflow: 'hidden',
  },
  worldWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(246, 238, 216, 0.10)',
  },
  safeFrame: {
    flex: 1,
    paddingHorizontal: OVERSCAN_X,
    paddingVertical: OVERSCAN_Y,
    gap: spacing.sm,
  },
  stageLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(246, 238, 216, 0.76)',
    borderBottomWidth: 2,
    borderBottomColor: triviaTvTheme.ink,
  },
  stageLabelLeaf: {
    width: 12,
    height: 20,
    borderRadius: 12,
    backgroundColor: triviaTvTheme.moss,
    transform: [{ rotate: '35deg' }],
  },
  stageLabelCopy: {
    color: triviaTvTheme.ink,
    letterSpacing: 2,
  },
  contentGrid: {
    flex: 1,
    gap: spacing.lg,
  },
  introStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['4xl'],
  },
  introLeaf: {
    position: 'absolute',
    right: 350,
    top: 160,
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.85,
  },
  introLeafStem: {
    width: 4,
    height: 106,
    backgroundColor: triviaTvTheme.mossDark,
    transform: [{ rotate: '36deg' }],
  },
  introLeafBud: {
    position: 'absolute',
    width: 38,
    height: 58,
    borderRadius: 36,
    backgroundColor: triviaTvTheme.moss,
    transform: [{ rotate: '36deg' }, { translateX: 20 }, { translateY: -18 }],
  },
  introBoard: {
    width: 930,
    maxWidth: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['4xl'],
    paddingVertical: spacing['3xl'],
    borderRadius: 10,
    backgroundColor: triviaTvTheme.parchmentSoft,
    borderColor: triviaTvTheme.ink,
    borderWidth: 2,
    borderTopWidth: 9,
    gap: spacing.lg,
    shadowColor: triviaTvTheme.shadow,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  playerRibbon: {
    position: 'absolute',
    bottom: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: triviaTvTheme.ink,
  },
  ribbonLabel: {
    color: triviaTvTheme.ink,
    letterSpacing: 1.8,
  },
  countdownLabel: {
    marginTop: spacing.sm,
    color: triviaTvTheme.inkSoft,
    letterSpacing: 3,
  },
  countdownMark: {
    minWidth: 320,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: triviaTvTheme.rule,
  },
  countdownNumber: {
    marginTop: -spacing.sm,
    fontSize: 168,
    lineHeight: 184,
    color: triviaTvTheme.mossDark,
  },
  legacyBoard: {
    flex: 1,
    width: 1060,
    maxWidth: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['4xl'],
    paddingVertical: spacing['3xl'],
    borderRadius: 10,
    backgroundColor: triviaTvTheme.parchmentSoft,
    borderColor: triviaTvTheme.coral,
    borderWidth: 2,
    borderTopWidth: 9,
    gap: spacing.lg,
    shadowColor: triviaTvTheme.shadow,
    shadowOpacity: 0.38,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  gameBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandMark: {
    width: 20,
    height: 20,
    borderRadius: 2,
    backgroundColor: triviaTvTheme.moss,
    borderColor: triviaTvTheme.ink,
    borderWidth: 2,
    transform: [{ rotate: '45deg' }],
  },
  brandLabel: {
    color: triviaTvTheme.ink,
    letterSpacing: 2.1,
  },
  dimCopy: {
    color: triviaTvTheme.inkSoft,
  },
  topRow: {
    minHeight: 112,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.xl,
  },
  headingCopy: {
    gap: spacing.xs,
  },
  kicker: {
    color: triviaTvTheme.inkSoft,
    letterSpacing: 1.5,
  },
  timerPill: {
    width: 124,
    height: 124,
    borderRadius: 62,
    borderColor: triviaTvTheme.ink,
    borderWidth: 5,
    backgroundColor: triviaTvTheme.honey,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: spacing.xs,
    shadowColor: triviaTvTheme.shadow,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  questionPanel: {
    minHeight: 214,
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: triviaTvTheme.parchmentSoft,
    borderColor: triviaTvTheme.ink,
    borderWidth: 2,
    borderLeftWidth: 10,
    shadowColor: triviaTvTheme.shadow,
    shadowOpacity: 0.38,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
  optionGrid: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'stretch',
  },
  option: {
    flex: 1,
    minWidth: 0,
    minHeight: 156,
    padding: spacing.xl,
    borderRadius: 8,
    borderColor: triviaTvTheme.ink,
    borderWidth: 2,
    borderBottomWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    shadowColor: triviaTvTheme.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  optionLetter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: triviaTvTheme.ink,
  },
  optionCopy: {
    width: '100%',
    minHeight: 28,
    textAlign: 'center',
    color: triviaTvTheme.ink,
  },
  correctOption: {
    backgroundColor: triviaTvTheme.parchment,
    borderColor: triviaTvTheme.mossDark,
    borderWidth: 4,
    borderBottomWidth: 10,
  },
  correctLetter: {
    backgroundColor: triviaTvTheme.honey,
  },
  participationRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  participationCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  avatarStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  revealColumns: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xl,
    alignItems: 'stretch',
  },
  revealQuestion: {
    flex: 1.45,
    padding: spacing.xl,
    borderRadius: 8,
    backgroundColor: triviaTvTheme.parchmentSoft,
    borderColor: triviaTvTheme.ink,
    borderWidth: 2,
    borderLeftWidth: 10,
    gap: spacing.lg,
    justifyContent: 'center',
    shadowColor: triviaTvTheme.shadow,
    shadowOpacity: 0.36,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
  resultsPanel: {
    flex: 1,
    minWidth: 0,
    padding: spacing.xl,
    borderRadius: 8,
    backgroundColor: 'rgba(185, 211, 190, 0.94)',
    borderColor: triviaTvTheme.ink,
    borderWidth: 2,
    gap: spacing.lg,
    shadowColor: triviaTvTheme.shadow,
    shadowOpacity: 0.30,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  resultsHeading: {
    gap: spacing.xs,
  },
  verdictList: {
    gap: spacing.sm,
  },
  /** Compact two-column reveal outcomes keep all ten seats above the fold. */
  verdictGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    columnGap: spacing.sm,
    rowGap: spacing.xs,
  },
  scoreRow: {
    minHeight: 56,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: triviaTvTheme.rule,
    backgroundColor: 'rgba(246, 238, 216, 0.58)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  awayRow: {
    opacity: 0.68,
  },
  scoreGridRow: {
    flexBasis: '47%',
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 50,
  },
  scoreIdentity: {
    flex: 1,
    gap: spacing.xs,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: triviaTvTheme.honey,
  },
  scoreAvatarFallback: {
    width: 36,
    height: 36,
  },
  finishedHeader: {
    flex: 0.64,
    width: '100%',
    maxWidth: 1160,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: 8,
    backgroundColor: triviaTvTheme.parchmentSoft,
    borderColor: triviaTvTheme.ink,
    borderWidth: 2,
    borderTopWidth: 8,
  },
  finalList: {
    flex: 1,
    maxWidth: 1480,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'center',
    columnGap: spacing.md,
    rowGap: spacing.md,
  },
  /** Ten-player finals use two compact columns inside the overscan frame. */
  finalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    columnGap: spacing.md,
    rowGap: spacing.sm,
  },
  finalRow: {
    flexGrow: 1,
    flexBasis: '29%',
    minHeight: 180,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: 6,
    backgroundColor: triviaTvTheme.parchmentSoft,
    borderColor: triviaTvTheme.ink,
    borderWidth: 2,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    shadowColor: triviaTvTheme.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  firstPlaceRow: {
    height: 300,
    backgroundColor: triviaTvTheme.sage,
  },
  secondPlaceRow: {
    height: 288,
    backgroundColor: triviaTvTheme.honey,
  },
  thirdPlaceRow: {
    height: 276,
    backgroundColor: triviaTvTheme.coral,
  },
  finalGridRow: {
    flexBasis: '47%',
    flexGrow: 1,
    flexShrink: 1,
    height: 68,
    minHeight: 68,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  winnerRow: {
    backgroundColor: triviaTvTheme.sage,
    borderColor: triviaTvTheme.ink,
    borderWidth: 3,
  },
  rankPill: {
    width: 54,
    height: 54,
    borderRadius: 4,
    backgroundColor: triviaTvTheme.honey,
    borderColor: triviaTvTheme.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalName: {
    flex: 1,
    textAlign: 'center',
  },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 3,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagCopy: {
    color: triviaTvTheme.ink,
    letterSpacing: 1.2,
  },
  paperTag: {
    backgroundColor: triviaTvTheme.parchment,
    borderColor: triviaTvTheme.ink,
  },
  readyTag: {
    backgroundColor: triviaTvTheme.honey,
    borderColor: triviaTvTheme.ink,
  },
  mutedTag: {
    backgroundColor: triviaTvTheme.sage,
    borderColor: triviaTvTheme.inkSoft,
  },
});
