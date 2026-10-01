import type { PhoneGameScreenProps } from '@huddle/domain';
import {
  HuddleButton,
  HuddleText,
  ScreenShell,
} from '@huddle/ui/game-kit';
import { useEffect, useState } from 'react';
import { Image, ImageBackground, ScrollView, StatusBar, StyleSheet, View } from 'react-native';

import { answerScreen, type AnswerOption } from './answering';
import { playableState } from './state';
import { triviaOptionTones, triviaTvTheme } from './tv-theme';
import type { TriviaEvent, TriviaState } from './types';
import { triviaPalette, triviaSpacing, triviaRadii } from './theme';
import { TRIVIA_ART } from './art';

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
  hostChromeInsetBottom,
  clockRemainingMs,
}: PhoneGameScreenProps<TriviaState, TriviaEvent>) {
  const deviceInsets = safeAreaInsets ?? ZERO_INSETS;
  // Platform chrome at the bottom (the Host's Back to lobby) extends the
  // device inset, so every surface's footer stays clear of it.
  const insets = { ...deviceInsets, bottom: deviceInsets.bottom + finiteInset(hostChromeInsetBottom) };
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
        <StatusBar barStyle="dark-content" backgroundColor={triviaPalette.cream} />
        <ImageBackground
          source={TRIVIA_ART.leaves}
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
              paddingTop: insets.top + chromeInsetTop + triviaSpacing.lg,
              paddingBottom: insets.bottom + triviaSpacing.xl,
            },
          ]}
          showsVerticalScrollIndicator={false}
          testID="trivia-phone-scroll"
        >
          <View style={styles.page}>
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
                <HuddleText variant="title" style={styles.timerLabel}>{String(countdownSeconds).padStart(2, '0')}</HuddleText>
                <HuddleText variant="caption" style={styles.compatibilityHidden}>{`${countdownSeconds}s`}</HuddleText>
              </View>
            </View>

            <HuddleText variant="caption" align="center" style={styles.roundLabel}>
              Question {model.questionIndex + 1} of {current.questions.length}
            </HuddleText>

            <View style={styles.questionPanel}>
              <HuddleText variant="title" align="center" accessibilityRole="header" style={styles.questionTitle}>
                {model.text}
              </HuddleText>
              <HuddleText variant="caption" align="center" style={styles.questionPrivacyNote}>
                Your choice stays on this phone until the reveal.
              </HuddleText>
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
      <View style={styles.gameMark} accessible accessibilityLabel="Trivia">
        <View style={styles.gameMarkLeaf} />
        <View style={styles.gameMarkStem} />
      </View>
      <HuddleText variant="title" style={styles.brandTitle}>TRIVIA</HuddleText>
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
      <StatusBar barStyle="dark-content" backgroundColor={triviaPalette.cream} />
      <ImageBackground
        source={TRIVIA_ART.leaves}
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
            paddingTop: insets.top + chromeInsetTop + triviaSpacing.xl,
            paddingRight: insets.right + triviaSpacing.xl,
            paddingBottom: insets.bottom + triviaSpacing.xl,
            paddingLeft: insets.left + triviaSpacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        testID="trivia-phone-waiting-scroll"
      >
        <View style={styles.statusContent} testID="trivia-phone-waiting-after-answer">
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
              <HuddleText variant="title" style={styles.timerLabel}>{String(countdownSeconds).padStart(2, '0')}</HuddleText>
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
            source={TRIVIA_ART.card}
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
        { backgroundColor: triviaOptionTones[option.optionIndex % triviaOptionTones.length] },
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
      <StatusBar barStyle="dark-content" backgroundColor={triviaPalette.cream} />
      <ImageBackground
        source={TRIVIA_ART.leaves}
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
            paddingTop: insets.top + chromeInsetTop + triviaSpacing.xl,
            paddingRight: insets.right + triviaSpacing.xl,
            paddingBottom: insets.bottom + triviaSpacing.xl,
            paddingLeft: insets.left + triviaSpacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        testID="trivia-phone-intro-scroll"
      >
        <View style={styles.introContent}>
          <TriviaBrandHeader />
          <Image
            source={TRIVIA_ART.card}
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
      <StatusBar barStyle="dark-content" backgroundColor={triviaPalette.cream} />
      <ImageBackground
        source={TRIVIA_ART.leaves}
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
            paddingTop: insets.top + chromeInsetTop + triviaSpacing.xl,
            paddingRight: insets.right + triviaSpacing.xl,
            paddingBottom: insets.bottom + triviaSpacing.xl,
            paddingLeft: insets.left + triviaSpacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        testID={`${testID}-scroll`}
      >
        <View style={[styles.statusContent, { paddingTop: 52 }]}>
          <HuddleText variant="display" align="center" accessibilityRole="header">
            {isLegacy ? 'Trivia needs an update' : isFinished ? 'All done!' : 'Eyes up!'}
          </HuddleText>
          <HuddleText variant="bodyLarge" align="center" accessibilityLiveRegion="polite">
            {line}
          </HuddleText>
          {!isLegacy ? <Image source={TRIVIA_ART.tvReveal} resizeMode="cover" style={styles.tvMark} accessible={false} testID={isFinished ? 'trivia-phone-finished-art' : 'trivia-phone-status-art'} /> : null}
          {!isLegacy && !isFinished ? <HuddleText variant="caption" style={styles.compatibilityHidden}>Eyes up.</HuddleText> : null}
          {isLegacy ? (
            <HuddleText variant="caption" align="center" style={styles.privateNote}>Return to the room to start a fresh game.</HuddleText>
          ) : phase === 'reveal' ? (
            <View style={styles.statusFooter}>
              <HuddleText variant="body" align="center">Watch the TV for the correct answer and results.</HuddleText>
            </View>
          ) : isFinished ? (
            <View style={styles.statusFooter}>
              <HuddleText variant="title" align="center">Thanks for playing!</HuddleText>
              <HuddleText variant="body" align="center">Wait for the Host.</HuddleText>
            </View>
          ) : null}
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
    backgroundColor: triviaPalette.cream,
  },
  worldWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: triviaPalette.cream,
    opacity: 0.08,
  },
  scroll: {
    flexGrow: 1,
  },
  page: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: triviaSpacing.xl,
    gap: triviaSpacing.md,
  },
  brandHeader: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: triviaSpacing.sm,
  },
  gameMark: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gameMarkLeaf: {
    width: 16,
    height: 22,
    borderRadius: 16,
    backgroundColor: triviaTvTheme.moss,
    transform: [{ rotate: '38deg' }, { translateX: 4 }, { translateY: -2 }],
  },
  gameMarkStem: {
    position: 'absolute',
    width: 2,
    height: 24,
    backgroundColor: triviaTvTheme.ink,
    transform: [{ rotate: '34deg' }, { translateX: -1 }],
  },
  brandTitle: {
    letterSpacing: -0.4,
    color: triviaTvTheme.ink,
  },
  roundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 0,
    width: '100%',
  },
  serverPill: {
    minHeight: 62,
    flex: 1,
    paddingHorizontal: triviaSpacing.md,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: triviaTvTheme.ink,
    backgroundColor: triviaTvTheme.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: triviaSpacing.xs,
  },
  pillIcon: {
    fontSize: 15,
  },
  timerPill: {
    minWidth: 88,
    minHeight: 88,
    paddingHorizontal: triviaSpacing.md,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: triviaTvTheme.ink,
    backgroundColor: triviaTvTheme.honey,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: triviaTvTheme.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  timerLabel: {
    fontSize: 36,
    lineHeight: 44,
  },
  compatibilityHidden: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
  roundLabel: {
    color: triviaTvTheme.inkSoft,
    letterSpacing: 1.1,
    fontSize: 13,
  },
  questionTitle: { fontSize: 21, lineHeight: 28, paddingVertical: 12 },
  questionPanel: {
    minHeight: 96,
    paddingHorizontal: triviaSpacing.lg,
    paddingVertical: triviaSpacing.lg,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: triviaTvTheme.ink,
    borderLeftWidth: 7,
    backgroundColor: triviaTvTheme.parchmentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    gap: triviaSpacing.sm,
    shadowColor: triviaTvTheme.shadow,
    shadowOpacity: 0.22,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  privateNote: {
    opacity: 0.66,
  },
  questionPrivacyNote: {
    position: 'absolute',
    opacity: 0,
    height: 0,
  },
  options: {
    width: '100%',
    gap: triviaSpacing.sm,
  },
  answerButton: {
    minHeight: 62,
    paddingHorizontal: triviaSpacing.lg,
    paddingVertical: triviaSpacing.sm,
    borderRadius: 6,
    borderColor: triviaTvTheme.ink,
    borderWidth: 2,
    borderBottomWidth: 5,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    position: 'relative',
    opacity: 1,
    shadowOpacity: 0,
    elevation: 0,
  },
  answerSelected: {
    backgroundColor: triviaTvTheme.parchment,
    borderColor: triviaTvTheme.mossDark,
    borderWidth: 3,
    opacity: 1,
  },
  answerClosed: {
    opacity: 0.5,
  },
  optionLetter: {
    width: 42,
    height: 42,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: triviaTvTheme.ink,
  },
  optionLetterSelected: {
    backgroundColor: triviaTvTheme.honey,
  },
  optionLetterText: {
    fontSize: 12,
  },
  answerLabel: {
    flex: 1,
    textAlign: 'center',
    color: triviaTvTheme.ink,
  },
  answerLock: {
    fontSize: 16,
    position: 'absolute',
    right: triviaSpacing.md,
  },
  lockNote: {
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: triviaSpacing.xs,
    paddingHorizontal: triviaSpacing.md,
    paddingVertical: triviaSpacing.sm,
  },
  lockIcon: {
    fontSize: 16,
  },
  statusScroll: {
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  statusContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 390,
    alignSelf: 'center',
    alignItems: 'center',
    gap: triviaSpacing.md,
  },
  statusArt: {
    width: 172,
    height: 172,
  },
  finishedArt: {
    width: 220,
    height: 262,
    borderRadius: triviaRadii.lg,
  },
  waitingPanel: {
    width: '100%',
    minHeight: 90,
    paddingHorizontal: triviaSpacing.lg,
    paddingVertical: triviaSpacing.lg,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: triviaTvTheme.ink,
    borderTopWidth: 6,
    backgroundColor: triviaTvTheme.parchmentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: triviaSpacing.xs,
    shadowColor: triviaTvTheme.shadow,
    shadowOpacity: 0.20,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  waitingArt: {
    width: 184,
    height: 184,
  },
  waitingFooter: {
    width: '100%',
    alignItems: 'center',
    gap: triviaSpacing.xs,
  },
  tvMark: {
    width: 224,
    height: 188,
    borderRadius: triviaRadii.lg,
    marginTop: triviaSpacing.sm,
  },
  statusFooter: {
    marginTop: 'auto',
    width: '100%',
    paddingHorizontal: triviaSpacing.lg,
    paddingVertical: triviaSpacing.lg,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: triviaTvTheme.ink,
    borderLeftWidth: 7,
    backgroundColor: triviaTvTheme.parchmentSoft,
    alignItems: 'center',
    gap: triviaSpacing.xs,
    shadowColor: triviaTvTheme.shadow,
    shadowOpacity: 0.20,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  introContent: {
    width: '100%',
    maxWidth: 390,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: triviaSpacing.sm,
  },
  introArt: {
    width: 188,
    height: 188,
    marginTop: triviaSpacing.sm,
  },
  introTitle: {
    fontSize: 34,
    lineHeight: 40,
    color: triviaTvTheme.ink,
  },
  introCopy: {
    maxWidth: 320,
  },
  introSummary: {
    width: '100%',
    maxWidth: 340,
    marginTop: triviaSpacing.sm,
    paddingHorizontal: triviaSpacing.lg,
    paddingVertical: triviaSpacing.md,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: triviaTvTheme.ink,
    borderTopWidth: 6,
    backgroundColor: triviaTvTheme.parchmentSoft,
    alignItems: 'center',
    gap: triviaSpacing.xs,
    shadowColor: triviaTvTheme.shadow,
    shadowOpacity: 0.20,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
});
