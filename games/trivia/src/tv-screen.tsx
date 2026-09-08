import type { TvGameScreenProps } from '@huddle/domain';
import { radii, semanticColors, shadows, spacing } from '@huddle/design-tokens';
import {
  AvatarPortrait,
  Badge,
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
        <View style={styles.safeFrame} pointerEvents="none" focusable={false}>
          <HuddleText variant="caption" color="text" style={styles.stageLabel} accessibilityElementsHidden>
            HUDDLE · TRIVIA
          </HuddleText>
          {screen.kind === 'legacy' ? <LegacyStage questionCount={screen.questionCount} /> : null}
          {screen.kind === 'intro' ? <IntroStage screen={screen} players={players} /> : null}
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
      <Badge label="TRIVIA" tone="away" />
      <HuddleText variant="tvDisplay" color="text" align="center">Room needs an update</HuddleText>
      <HuddleText variant="bodyLarge" color="text" align="center">
        This launch-proof room was set for {questionCount} questions. Return to the room to start a new round.
      </HuddleText>
    </View>
  );
}

function IntroStage({
  screen,
  players,
}: {
  readonly screen: Extract<WatchedScreen, { kind: 'intro' }>;
  readonly players: readonly TvGameScreenProps<TriviaState>['players'][number][];
}) {
  return (
    <View style={styles.introStage} accessible accessibilityRole="text" accessibilityLabel={`Trivia ready. Get ready! ${screen.questionCount} questions. ${screen.playerCount} players. Answers happen on the phones. The room reveals together here.`}>
      <View style={styles.introBoard} pointerEvents="none" focusable={false}>
        <View style={styles.gameBrand} pointerEvents="none" focusable={false}>
          <View style={styles.brandMark} />
          <HuddleText variant="title" color="text">Trivia</HuddleText>
        </View>
        <Badge label="TRIVIA" tone="ready" />
        <HuddleText variant="tvDisplay" color="text" align="center">Get ready!</HuddleText>
        <HuddleText variant="title" color="text" align="center">
          {screen.questionCount} questions · {screen.playerCount} players
        </HuddleText>
        <HuddleText variant="bodyLarge" color="text" align="center" style={styles.dimCopy}>
          Answers happen on the phones. The room reveals together here.
        </HuddleText>
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
          <HuddleText variant="caption" color="text" style={styles.kicker}>QUESTION {screen.questionNumber} OF {screen.questionCount}</HuddleText>
          <HuddleText variant="title" color="text">Choose on your phone</HuddleText>
        </View>
        <View style={styles.timerPill}>
          <HuddleText variant="hero" color="text" accessibilityElementsHidden>{screen.countdownSeconds}</HuddleText>
          <HuddleText variant="caption" color="text" accessibilityElementsHidden>SEC</HuddleText>
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
          <Badge label={`${screen.answered}/${screen.playerCount} answered`} tone={screen.answered === screen.playerCount ? 'ready' : 'host'} />
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
        <Badge label="Reveal" tone="ready" />
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
          <HuddleText variant="title" color="text">Trivia complete</HuddleText>
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
    <View style={[styles.option, correct ? styles.correctOption : null]} pointerEvents="none" focusable={false}>
      <View style={[styles.optionLetter, correct ? styles.correctLetter : null]}>
        <HuddleText variant="title" color="text" accessibilityElementsHidden>
          {String.fromCharCode(65 + option.optionIndex)}
        </HuddleText>
      </View>
      <HuddleText variant="bodyLarge" color="text" style={styles.optionCopy} numberOfLines={2}>
        {option.text}
      </HuddleText>
      {correct ? <Badge label="Correct" tone="ready" /> : null}
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
    backgroundColor: semanticColors.background,
  },
  stage: {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    overflow: 'hidden',
  },
  safeFrame: {
    flex: 1,
    paddingHorizontal: OVERSCAN_X,
    paddingVertical: OVERSCAN_Y,
    gap: spacing.sm,
  },
  stageLabel: {
    letterSpacing: 2,
    opacity: 0.72,
    paddingLeft: spacing.xs,
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
  introBoard: {
    width: 1060,
    maxWidth: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['4xl'],
    paddingVertical: spacing['3xl'],
    borderRadius: 40,
    backgroundColor: 'rgba(249, 241, 230, 0.84)',
    borderColor: semanticColors.success,
    borderWidth: 4,
    gap: spacing.lg,
    ...shadows.floating,
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
    borderRadius: 40,
    backgroundColor: 'rgba(249, 241, 230, 0.88)',
    borderColor: semanticColors.highlight,
    borderWidth: 4,
    gap: spacing.lg,
    ...shadows.floating,
  },
  gameBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandMark: {
    width: 20,
    height: 20,
    borderRadius: radii.round,
    backgroundColor: semanticColors.success,
    borderColor: semanticColors.text,
    borderWidth: 3,
  },
  dimCopy: {
    opacity: 0.68,
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
    letterSpacing: 1.5,
    opacity: 0.72,
  },
  timerPill: {
    width: 124,
    height: 124,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.round,
    borderColor: semanticColors.text,
    borderWidth: 4,
    backgroundColor: 'rgba(249, 241, 230, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: spacing.xs,
    ...shadows.raised,
  },
  questionPanel: {
    minHeight: 220,
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
    backgroundColor: 'rgba(249, 241, 230, 0.88)',
    borderColor: semanticColors.success,
    borderWidth: 4,
    ...shadows.floating,
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
    borderRadius: 28,
    backgroundColor: 'rgba(249, 241, 230, 0.96)',
    borderColor: 'rgba(43, 31, 23, 0.16)',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  optionLetter: {
    width: 64,
    height: 64,
    borderRadius: radii.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semanticColors.success,
  },
  optionCopy: {
    width: '100%',
    minHeight: 28,
    textAlign: 'center',
  },
  correctOption: {
    backgroundColor: semanticColors.success,
    borderColor: semanticColors.success,
    borderWidth: 4,
  },
  correctLetter: {
    backgroundColor: semanticColors.surface,
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
    borderRadius: 36,
    backgroundColor: 'rgba(249, 241, 230, 0.9)',
    borderColor: semanticColors.success,
    borderWidth: 4,
    gap: spacing.lg,
    justifyContent: 'center',
    ...shadows.floating,
  },
  resultsPanel: {
    flex: 1,
    minWidth: 0,
    padding: spacing.xl,
    borderRadius: 36,
    backgroundColor: 'rgba(127, 210, 182, 0.9)',
    borderColor: semanticColors.text,
    borderWidth: 2,
    gap: spacing.lg,
    ...shadows.floating,
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
    padding: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: 'rgba(249, 241, 230, 0.88)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.card,
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
    borderRadius: radii.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semanticColors.secondary,
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
    borderRadius: 36,
    backgroundColor: 'rgba(249, 241, 230, 0.78)',
    borderColor: semanticColors.success,
    borderWidth: 3,
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
    borderRadius: 28,
    backgroundColor: 'rgba(249, 241, 230, 0.94)',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    ...shadows.card,
  },
  firstPlaceRow: {
    height: 300,
    backgroundColor: semanticColors.success,
  },
  secondPlaceRow: {
    height: 288,
    backgroundColor: semanticColors.secondary,
  },
  thirdPlaceRow: {
    height: 276,
    backgroundColor: semanticColors.primary,
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
    backgroundColor: semanticColors.success,
    borderColor: semanticColors.text,
    borderWidth: 3,
  },
  rankPill: {
    width: 54,
    height: 54,
    borderRadius: radii.round,
    backgroundColor: 'rgba(249, 241, 230, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalName: {
    flex: 1,
    textAlign: 'center',
  },
});
