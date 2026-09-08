import { brandColors, radii, semanticColors, shadows, spacing } from '@huddle/design-tokens';
import type { PhoneGameScreenProps } from '@huddle/domain';
import {
  HEARTBEAT_ARTWORK,
  HuddleButton,
  HuddleText,
  ScreenShell,
} from '@huddle/ui/native';
import { useEffect, useState } from 'react';
import { Image, ImageBackground, ScrollView, StyleSheet, View } from 'react-native';

import { answerScreen, type AnswerOption } from './answering';
import { playableState } from './state';
import type { TriviaEvent, TriviaState } from './types';

/**
 * Trivia's private controller surface.
 *
 * The Phone is the only place where a player sees and sends an answer. The
 * state handed to this component is already projected for its owner by the
 * room; this renderer never attempts to reconstruct another player's choice or
 * the answer key. The TV owns the shared question and reveal.
 */
export function TriviaPhoneScreen({
  state,
  player,
  sendEvent,
  safeAreaInsets,
  hostChromeInsetTop,
  clockRemainingMs,
}: PhoneGameScreenProps<TriviaState, TriviaEvent>) {
  const insets = safeAreaInsets ?? ZERO_INSETS;
  const chromeInsetTop = finiteInset(hostChromeInsetTop);
  const current = playableState(state);
  const countdownSeconds = useCountdownSeconds(
    current?.phase === 'question' ? clockRemainingMs : undefined,
    current?.phase === 'question' ? current.questionSeconds ?? 20 : 0,
    current === undefined ? 'legacy' : `${current.questionIndex}:${current.phase}`,
  );

  if (current === undefined) {
    return (
      <TriviaStatusSurface
        phase="legacy"
        line="Ask the Host to return to the room and start Trivia again."
        insets={insets}
        chromeInsetTop={chromeInsetTop}
        testID="trivia-phone-legacy"
      />
    );
  }

  if (current.phase === 'intro') {
    return (
      <TriviaIntroSurface
        questionCount={current.questions.length}
        insets={insets}
        chromeInsetTop={chromeInsetTop}
      />
    );
  }

  const model = answerScreen(state, player.playerId);

  // Once this phone has submitted, answers are intentionally no longer
  // rendered here. The answer belongs to the player, while the waiting
  // surface only communicates the shared progress that is safe to show.
  if (model.kind === 'question' && model.lockedIn) {
    return (
      <TriviaWaitingSurface
        questionIndex={model.questionIndex}
        questionCount={current.questions.length}
        countdownSeconds={countdownSeconds}
        participationCount={current.participationCount}
        playerCount={current.standings.length}
        insets={insets}
        chromeInsetTop={chromeInsetTop}
      />
    );
  }

  if (model.kind === 'question') {
    return (
      <ScreenShell tone="background" style={styles.shell} testID="trivia-phone-screen">
        <ImageBackground
          source={HEARTBEAT_ARTWORK.gameWorlds.trivia}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          accessible={false}
          testID="trivia-phone-world"
        />
        <View style={styles.worldWash} pointerEvents="none" />
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingLeft: insets.left,
              paddingRight: insets.right,
              paddingTop: insets.top + chromeInsetTop + spacing.lg,
              paddingBottom: insets.bottom + spacing.xl,
            },
          ]}
          showsVerticalScrollIndicator={false}
          testID="trivia-phone-scroll"
        >
          <View style={styles.page}>
            <TriviaBrandHeader />

            <View style={styles.roundRow}>
              <View style={styles.serverPill}>
                <HuddleText variant="caption" style={styles.pillIcon} accessibilityElementsHidden>⌛</HuddleText>
                <HuddleText variant="caption">Server countdown</HuddleText>
              </View>
              <View
                style={styles.timerPill}
                testID="trivia-phone-clock"
                accessible
                accessibilityRole="text"
                accessibilityLabel={`${countdownSeconds} seconds remaining`}
              >
                <HuddleText variant="title" style={styles.timerLabel}>{countdownSeconds}s</HuddleText>
              </View>
            </View>

            <HuddleText variant="caption" align="center" style={styles.roundLabel}>
              Question {model.questionIndex + 1} of {current.questions.length}
            </HuddleText>

            <View style={styles.questionPanel}>
              <HuddleText variant="title" align="center" accessibilityRole="header">
                {model.text}
              </HuddleText>
              <HuddleText variant="caption" align="center" style={styles.privateNote}>
                Your choice stays on this phone until the reveal.
              </HuddleText>
            </View>

            <View style={styles.options}>
              {model.options.map((option) => (
                <TriviaAnswerButton
                  key={option.optionIndex}
                  option={option}
                  onPress={() => sendEvent({
                    kind: 'answer',
                    playerId: player.playerId,
                    questionIndex: model.questionIndex,
                    optionIndex: option.optionIndex,
                  })}
                />
              ))}
            </View>

            <View style={styles.lockNote} accessibilityLiveRegion="polite">
              <HuddleText variant="body" style={styles.lockIcon} accessibilityElementsHidden>🔒</HuddleText>
              <HuddleText variant="body" align="center">
                {model.lockedIn ? 'Locked in' : 'Tap an answer to lock it in'}
              </HuddleText>
              <HuddleText variant="caption" align="center" style={styles.privateNote}>
                {model.lockedIn ? 'You can’t change your answer.' : 'Your first choice is final.'}
              </HuddleText>
            </View>
          </View>
        </ScrollView>
      </ScreenShell>
    );
  }

  return (
    <TriviaStatusSurface
      phase={current.phase}
      line={model.line}
      insets={insets}
      chromeInsetTop={chromeInsetTop}
      testID={`trivia-phone-${current.phase}`}
    />
  );
}

function TriviaBrandHeader() {
  return (
    <View style={styles.brandHeader} accessibilityRole="header">
      <Image
        source={HEARTBEAT_ARTWORK.brand.displayMark}
        resizeMode="contain"
        style={styles.brandMark}
        accessible
        accessibilityLabel="Huddle"
      />
      <HuddleText variant="title" style={styles.brandTitle}>Trivia</HuddleText>
    </View>
  );
}

function TriviaWaitingSurface({
  questionIndex,
  questionCount,
  countdownSeconds,
  participationCount,
  playerCount,
  insets,
  chromeInsetTop,
}: {
  readonly questionIndex: number;
  readonly questionCount: number;
  readonly countdownSeconds: number;
  readonly participationCount?: number;
  readonly playerCount: number;
  readonly insets: Insets;
  readonly chromeInsetTop: number;
}) {
  const hasSafeParticipation = Number.isFinite(participationCount)
    && playerCount > 0;
  const answered = hasSafeParticipation
    ? Math.min(playerCount, Math.max(0, Math.round(participationCount ?? 0)))
    : undefined;

  return (
    <ScreenShell
      tone="background"
      style={[styles.shell, styles.worldRoot]}
      testID="trivia-phone-waiting"
    >
      <ImageBackground
        source={HEARTBEAT_ARTWORK.gameWorlds.trivia}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
        accessible={false}
        testID="trivia-phone-waiting-world"
      />
      <View style={styles.worldWash} pointerEvents="none" />
      <ScrollView
        contentContainerStyle={[
          styles.statusScroll,
          {
            paddingTop: insets.top + chromeInsetTop + spacing.xl,
            paddingRight: insets.right + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
            paddingLeft: insets.left + spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        testID="trivia-phone-waiting-scroll"
      >
        <View style={styles.statusContent} testID="trivia-phone-waiting-after-answer">
          <TriviaBrandHeader />
          <View style={styles.roundRow}>
            <View style={styles.serverPill}>
              <HuddleText variant="caption" style={styles.pillIcon} accessibilityElementsHidden>⌛</HuddleText>
              <HuddleText variant="caption">Server countdown</HuddleText>
            </View>
            <View
              style={styles.timerPill}
              accessible
              accessibilityRole="text"
              accessibilityLabel={`${countdownSeconds} seconds remaining`}
              testID="trivia-phone-waiting-clock"
            >
              <HuddleText variant="title" style={styles.timerLabel}>{countdownSeconds}s</HuddleText>
            </View>
          </View>
          <HuddleText variant="caption" align="center" style={styles.roundLabel}>
            Question {questionIndex + 1} of {questionCount}
          </HuddleText>
          <View style={styles.waitingPanel} accessible accessibilityLiveRegion="polite">
            <HuddleText variant="title" align="center">
              {answered === undefined ? 'Waiting for others' : `${answered} of ${playerCount} answered`}
            </HuddleText>
            <HuddleText variant="body" align="center" style={styles.privateNote}>
              {answered === undefined ? 'Your answer is locked.' : 'Waiting for others…'}
            </HuddleText>
          </View>
          <Image
            source={HEARTBEAT_ARTWORK.gameCards.trivia}
            resizeMode="contain"
            style={styles.waitingArt}
            accessible={false}
          />
          <View style={styles.waitingFooter}>
            <HuddleText variant="title" align="center">Hang tight!</HuddleText>
            <HuddleText variant="body" align="center" style={styles.privateNote}>
              Answer revealed on the TV.
            </HuddleText>
          </View>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

function TriviaAnswerButton({
  option,
  onPress,
}: {
  readonly option: AnswerOption;
  readonly onPress: () => void;
}) {
  const isSelected = option.state === 'lockedIn';
  const disabled = option.state !== 'open';
  const isClosed = option.state === 'closed';
  const letter = String.fromCharCode(65 + option.optionIndex);

  return (
    <HuddleButton
      variant="secondary"
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={`Answer ${letter}: ${option.text}`}
      accessibilityHint={disabled ? 'This answer is locked.' : 'Locks this answer for the current question.'}
      testID={`trivia-answer-${option.optionIndex}`}
      style={[
        styles.answerButton,
        isSelected ? styles.answerSelected : null,
        isClosed ? styles.answerClosed : null,
      ]}
    >
      <View style={[styles.optionLetter, isSelected ? styles.optionLetterSelected : null]}>
        <HuddleText variant="caption" style={styles.optionLetterText}>{letter}</HuddleText>
      </View>
      <HuddleText variant="body" style={styles.answerLabel}>{option.text}</HuddleText>
      {isSelected ? <HuddleText variant="body" style={styles.answerLock} accessibilityElementsHidden>🔒</HuddleText> : null}
    </HuddleButton>
  );
}

function TriviaIntroSurface({
  questionCount,
  insets,
  chromeInsetTop,
}: {
  readonly questionCount: number;
  readonly insets: Insets;
  readonly chromeInsetTop: number;
}) {
  return (
    <ScreenShell tone="background" style={[styles.shell, styles.worldRoot]} testID="trivia-phone-intro">
      <ImageBackground
        source={HEARTBEAT_ARTWORK.gameWorlds.trivia}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
        accessible={false}
        testID="trivia-phone-intro-world"
      />
      <View style={styles.worldWash} pointerEvents="none" />
      <ScrollView
        contentContainerStyle={[
          styles.statusScroll,
          {
            paddingTop: insets.top + chromeInsetTop + spacing.xl,
            paddingRight: insets.right + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
            paddingLeft: insets.left + spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        testID="trivia-phone-intro-scroll"
      >
        <View style={styles.introContent}>
          <TriviaBrandHeader />
          <Image
            source={HEARTBEAT_ARTWORK.gameCards.trivia}
            resizeMode="contain"
            style={styles.introArt}
            accessible={false}
          />
          <HuddleText variant="display" align="center" style={styles.introTitle}>Get ready!</HuddleText>
          <HuddleText variant="bodyLarge" align="center" style={styles.introCopy}>
            {questionCount} questions. Keep your phone close and eyes on the TV.
          </HuddleText>
          <View style={styles.introSummary}>
            <HuddleText variant="body" align="center">Your phone is the answer pad.</HuddleText>
            <HuddleText variant="caption" align="center" style={styles.privateNote}>The game starts on the TV.</HuddleText>
          </View>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

function TriviaStatusSurface({
  phase,
  line,
  insets,
  chromeInsetTop,
  testID,
}: {
  readonly phase: TriviaPhaseForPhone;
  readonly line: string;
  readonly insets: Insets;
  readonly chromeInsetTop: number;
  readonly testID: string;
}) {
  const isFinished = phase === 'finished';
  const isLegacy = phase === 'legacy';
  return (
    <ScreenShell tone="background" style={[styles.shell, styles.worldRoot]} testID={testID}>
      <ImageBackground
        source={HEARTBEAT_ARTWORK.gameWorlds.trivia}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
        accessible={false}
        testID={`${testID}-world`}
      />
      <View style={styles.worldWash} pointerEvents="none" />
      <ScrollView
        contentContainerStyle={[
          styles.statusScroll,
          {
            paddingTop: insets.top + chromeInsetTop + spacing.xl,
            paddingRight: insets.right + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
            paddingLeft: insets.left + spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        testID={`${testID}-scroll`}
      >
        <View style={styles.statusContent}>
          <TriviaBrandHeader />
          <Image
            source={isFinished ? HEARTBEAT_ARTWORK.phone.gameFinished : HEARTBEAT_ARTWORK.gameCards.trivia}
            resizeMode={isFinished ? 'cover' : 'contain'}
            style={isFinished ? styles.finishedArt : styles.statusArt}
            accessible={false}
            testID={isFinished ? 'trivia-phone-finished-art' : 'trivia-phone-status-art'}
          />
          <HuddleText variant="display" align="center" accessibilityRole="header">
            {isLegacy ? 'Trivia needs an update' : isFinished ? 'All done!' : 'Eyes up.'}
          </HuddleText>
          <HuddleText variant="bodyLarge" align="center" accessibilityLiveRegion="polite">
            {line}
          </HuddleText>
          <HuddleText variant="caption" align="center" style={styles.privateNote}>
            {isLegacy ? 'Return to the room to start a fresh game.' : isFinished ? 'Final scores are on the TV.' : 'Shared results and the answer key live on the TV.'}
          </HuddleText>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

/**
 * Start a local visual countdown from the room's authoritative remainder. It
 * only changes what this phone displays; the server deadline remains the sole
 * authority that advances Trivia. A numeric countdown is information rather
 * than decorative motion, so it continues to tick for reduced-motion users;
 * these screens add no interpolated movement to suppress.
 */
function useCountdownSeconds(
  clockRemainingMs: number | undefined,
  fallbackSeconds: number,
  beat: string,
): number {
  const rawStartingMs = clockRemainingMs ?? fallbackSeconds * 1000;
  const startingMs = Number.isFinite(rawStartingMs)
    ? Math.max(0, rawStartingMs)
    : Math.max(0, fallbackSeconds * 1000);
  const initial = displaySeconds(startingMs, fallbackSeconds);
  const [display, setDisplay] = useState<{
    readonly beat: string;
    readonly startingMs: number;
    readonly seconds: number;
  }>({
    beat,
    startingMs,
    seconds: initial,
  });
  // An effect runs after paint. Derive the first value from the new beat during
  // render so a previous question's number cannot flash over this one.
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

function displaySeconds(clockRemainingMs: number | undefined, fallbackSeconds: number | undefined): number {
  if (clockRemainingMs !== undefined && Number.isFinite(clockRemainingMs)) {
    return Math.max(0, Math.ceil(clockRemainingMs / 1000));
  }
  return fallbackSeconds ?? 20;
}

function finiteInset(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? Math.max(0, value) : 0;
}

type Insets = {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
};

type TriviaPhaseForPhone = 'legacy' | 'question' | 'reveal' | 'finished';

const ZERO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

const styles = StyleSheet.create({
  shell: {
    paddingHorizontal: 0,
    overflow: 'hidden',
  },
  worldRoot: {
    backgroundColor: brandColors.cream,
  },
  worldWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: brandColors.cream,
    opacity: 0.68,
  },
  scroll: {
    flexGrow: 1,
  },
  page: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  brandHeader: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandMark: {
    width: 25,
    height: 24,
  },
  brandTitle: {
    letterSpacing: -0.4,
  },
  roundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  serverPill: {
    minHeight: 40,
    flex: 1,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(43,31,23,0.12)',
    backgroundColor: 'rgba(249,241,230,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  pillIcon: {
    fontSize: 15,
  },
  timerPill: {
    minWidth: 68,
    minHeight: 46,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: brandColors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  timerLabel: {
    fontSize: 24,
    lineHeight: 30,
  },
  roundLabel: {
    opacity: 0.8,
    fontSize: 13,
  },
  questionPanel: {
    minHeight: 142,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(43,31,23,0.1)',
    backgroundColor: 'rgba(249,241,230,0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.card,
  },
  privateNote: {
    opacity: 0.66,
  },
  options: {
    gap: spacing.sm,
  },
  answerButton: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderColor: 'rgba(43,31,23,0.12)',
    backgroundColor: brandColors.cream,
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    opacity: 1,
    ...shadows.card,
  },
  answerSelected: {
    backgroundColor: semanticColors.accent,
    borderColor: semanticColors.accent,
    opacity: 1,
  },
  answerClosed: {
    opacity: 0.5,
  },
  optionLetter: {
    width: 28,
    height: 28,
    borderRadius: radii.round,
    backgroundColor: brandColors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLetterSelected: {
    backgroundColor: 'rgba(249,241,230,0.7)',
  },
  optionLetterText: {
    fontSize: 12,
  },
  answerLabel: {
    flex: 1,
    textAlign: 'left',
  },
  answerLock: {
    fontSize: 16,
  },
  lockNote: {
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  lockIcon: {
    fontSize: 16,
  },
  statusScroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  statusContent: {
    width: '100%',
    maxWidth: 390,
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  statusArt: {
    width: 172,
    height: 172,
  },
  finishedArt: {
    width: 220,
    height: 262,
    borderRadius: radii.lg,
  },
  waitingPanel: {
    width: '100%',
    minHeight: 90,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(43,31,23,0.1)',
    backgroundColor: 'rgba(249,241,230,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    ...shadows.card,
  },
  waitingArt: {
    width: 184,
    height: 184,
  },
  waitingFooter: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.xs,
  },
  introContent: {
    width: '100%',
    maxWidth: 390,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  introArt: {
    width: 188,
    height: 188,
    marginTop: spacing.sm,
  },
  introTitle: {
    fontSize: 34,
    lineHeight: 40,
  },
  introCopy: {
    maxWidth: 320,
  },
  introSummary: {
    width: '100%',
    maxWidth: 340,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(43,31,23,0.1)',
    backgroundColor: 'rgba(249,241,230,0.88)',
    alignItems: 'center',
    gap: spacing.xs,
    ...shadows.card,
  },
});
