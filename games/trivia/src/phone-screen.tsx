import type { PhoneGameScreenProps, PhoneSafeAreaInsets } from '@huddle/domain';
import { useState, type ReactNode } from 'react';
import { Animated, Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';

import { answerScreen, type AnswerOption } from './answering';
import {
  answerTone,
  cosmic,
  CosmicText,
  COSMIC_MOTION,
  cosmicEaseOut,
  Enter,
  LetterBadge,
  LockMark,
  Logo,
  Mascot,
  Pill,
  timerLabel,
  Twinkle,
  useCountdownSeconds,
  useReducedMotion,
  type MascotPose,
} from './cosmic';
import { playableState, QUESTION_SECONDS, REVEAL_SECONDS } from './state';
import type { PlayableTriviaState, TriviaEvent, TriviaState } from './types';

/**
 * Trivia's private controller: the answer pad.
 *
 * The phone is the only place a player sees and sends an answer. The state it
 * is handed is already projected for its owner, so it never reconstructs
 * anybody else's choice or the answer key; the TV owns the shared question and
 * the reveal. Between questions the Host's phone alone offers "Next question".
 */
export function TriviaPhoneScreen({
  state,
  player,
  sendEvent,
  safeAreaInsets,
  hostChromeInsetTop,
  hostChromeInsetBottom,
  clockRemainingMs,
  isHost = false,
}: PhoneGameScreenProps<TriviaState, TriviaEvent>) {
  const reduceMotion = useReducedMotion();
  const device = safeAreaInsets ?? ZERO_INSETS;
  // Platform chrome at the bottom (the Host's Back to lobby) extends the
  // device inset, so every surface's footer stays clear of it.
  const insets = { ...device, bottom: device.bottom + finiteInset(hostChromeInsetBottom) };
  const chromeTop = finiteInset(hostChromeInsetTop);
  const current = playableState(state);
  const seconds = useCountdownSeconds(
    current?.phase === 'question' || current?.phase === 'reveal' ? clockRemainingMs : undefined,
    current?.phase === 'question' ? current.questionSeconds ?? QUESTION_SECONDS : current?.phase === 'reveal' ? REVEAL_SECONDS : 0,
    current === undefined ? 'legacy' : `${current.questionIndex}:${current.phase}`,
  );
  const frame = { insets, chromeTop };

  if (current === undefined) {
    return (
      <Surface {...frame} testID="trivia-phone-legacy">
        <Logo width={190} on="light" />
        <CosmicText weight="black" size={30} align="center" style={styles.heading}>Room needs an update</CosmicText>
        <CosmicText size={17} color={cosmic.muted} align="center">Ask the host to return to the room and start Trivia again.</CosmicText>
      </Surface>
    );
  }

  const count = current.questions.length;

  if (current.phase === 'intro') {
    return (
      <Surface {...frame} testID="trivia-phone-intro">
        <Logo width={200} on="light" />
        <Enter reduceMotion={reduceMotion}>
          <CosmicText weight="black" size={40} align="center" accessibilityRole="header" style={styles.heading}>Get ready!</CosmicText>
        </Enter>
        <Mascot pose="wave" width={210} reduceMotion={reduceMotion} />
        <Pill color={cosmic.turquoise} style={styles.pill}>
          <CosmicText weight="black" size={18} tracking={0.5}>{`${count} QUESTIONS`}</CosmicText>
        </Pill>
        <CosmicText weight="black" size={22} align="center" style={{ marginTop: 12 }}>Your phone is the answer pad.</CosmicText>
        <CosmicText weight="black" size={22} align="center" style={{ marginTop: 8 }}>Eyes on the TV!</CosmicText>
      </Surface>
    );
  }

  const model = answerScreen(state, player.playerId);
  const progress = `${current.questionIndex + 1} / ${count}`;

  if (model.kind === 'question' && model.lockedIn) {
    const answered = current.participationCount;
    return (
      <Surface {...frame} testID="trivia-phone-waiting-after-answer">
        <Header progress={progress} seconds={seconds} />
        <Enter reduceMotion={reduceMotion}>
          <CosmicText weight="black" size={34} align="center" accessibilityRole="header" style={styles.heading}>Answer locked!</CosmicText>
        </Enter>
        <Enter reduceMotion={reduceMotion} scale={0.88} from={0} delay={80}>
          <LockMark size={130} />
        </Enter>
        {/* The rest follows the lock in, so the swap from four answers never teleports. */}
        <Enter reduceMotion={reduceMotion} delay={160} style={{ alignItems: 'center' }}>
          {answered !== undefined ? (
            <CosmicText weight="bold" size={19} align="center" style={{ marginTop: 18 }}>
              {`${answered} of ${current.standings.length} answered`}
            </CosmicText>
          ) : null}
          <CosmicText size={16} color={cosmic.muted} align="center" style={{ marginTop: 4 }}>Waiting for others…</CosmicText>
          <Mascot pose="point" width={170} reduceMotion={reduceMotion} style={{ marginTop: 16 }} />
          <CosmicText weight="black" size={22} align="center">Eyes on the TV!</CosmicText>
          <CosmicText size={16} color={cosmic.muted} align="center">The reveal is coming.</CosmicText>
        </Enter>
      </Surface>
    );
  }

  if (model.kind === 'question') {
    return (
      <Surface {...frame} testID="trivia-phone-screen" scrollTestID="trivia-phone-scroll" align="stretch">
        <Header progress={progress} seconds={seconds} />
        {model.category ? (
          <Pill color={cosmic.turquoise} style={styles.categoryChip} testID="trivia-phone-category">
            <CosmicText weight="black" size={13} tracking={1.5}>{model.category.toUpperCase()}</CosmicText>
          </Pill>
        ) : null}
        <CosmicText weight="black" size={model.text.length > 80 ? 21 : 25} align="center" accessibilityRole="header" style={styles.question}>
          {model.text}
        </CosmicText>
        <View style={styles.answers}>
          {model.options.map((option, index) => (
            <Enter key={option.optionIndex} reduceMotion={reduceMotion} delay={index * 60} from={16}>
              <AnswerButton
                option={option}
                reduceMotion={reduceMotion}
                onPress={() =>
                  sendEvent({
                    kind: 'answer',
                    playerId: player.playerId,
                    questionIndex: model.questionIndex,
                    optionIndex: option.optionIndex,
                  })
                }
              />
            </Enter>
          ))}
        </View>
        <CosmicText size={15} color={cosmic.muted} align="center" style={{ marginTop: 14 }}>
          Tap an answer to lock it in. Your choice stays on this phone until the reveal.
        </CosmicText>
      </Surface>
    );
  }

  if (current.phase === 'reveal') {
    return (
      <RevealSurface
        {...frame}
        state={current}
        verdict={current.revealVerdicts?.[player.playerId]}
        progress={progress}
        seconds={seconds}
        isHost={isHost}
        reduceMotion={reduceMotion}
        onNext={() =>
          sendEvent({ kind: 'advance', playerId: player.playerId, questionIndex: current.questionIndex, phase: 'reveal' })
        }
      />
    );
  }

  if (current.phase === 'finished') {
    const place = finishingPlace(current, player.playerId);
    // Same call as the TV headline: a shared top score is a tie, never a win.
    const won = place?.rank === 1;
    return (
      <Surface {...frame} testID="trivia-phone-finished" scrollTestID="trivia-phone-finished-scroll">
        <Logo width={190} on="light" />
        <Pill color={cosmic.turquoise} style={styles.pill}>
          <CosmicText weight="black" size={15} tracking={1.5}>GAME COMPLETE</CosmicText>
        </Pill>
        <Enter reduceMotion={reduceMotion}>
          <CosmicText weight="black" size={36} align="center" accessibilityRole="header" style={styles.heading}>
            {won ? (place.shared ? 'It’s a tie!' : 'You won!') : 'That’s a wrap!'}
          </CosmicText>
        </Enter>
        <Mascot pose="celebrate" width={210} reduceMotion={reduceMotion} />
        {place ? (
          <Enter reduceMotion={reduceMotion} delay={250} scale={0.85} from={0} testID="trivia-phone-place">
            <View style={[styles.placeCard, { backgroundColor: won ? cosmic.butter : cosmic.periwinkle }]}>
              <CosmicText weight="black" size={40}>{ordinal(place.rank)}</CosmicText>
              <CosmicText weight="bold" size={17}>
                of {place.of} · {place.score} {place.score === 1 ? 'point' : 'points'}
              </CosmicText>
            </View>
          </Enter>
        ) : null}
        <CosmicText weight="black" size={19} align="center">Final scores are on the TV.</CosmicText>
        <View style={styles.rule} />
        <CosmicText size={16} color={cosmic.muted} align="center">
          {isHost ? 'Bring everyone back to the room.' : 'Waiting for the host to choose what’s next.'}
        </CosmicText>
      </Surface>
    );
  }

  return <EyesUp {...frame} pose="point" line={model.kind === 'eyesUp' ? model.line : ''} reduceMotion={reduceMotion} testID={`trivia-phone-${current.phase}`} />;
}

function RevealSurface({
  insets,
  chromeTop,
  state,
  verdict,
  progress,
  seconds,
  isHost,
  reduceMotion,
  onNext,
}: {
  readonly insets: PhoneSafeAreaInsets;
  readonly chromeTop: number;
  readonly state: PlayableTriviaState;
  /** This phone's own outcome, when the room has revealed it. */
  readonly verdict: boolean | undefined;
  readonly progress: string;
  readonly seconds: number;
  readonly isHost: boolean;
  readonly reduceMotion: boolean | undefined;
  readonly onNext: () => void;
}) {
  const last = state.questionIndex + 1 >= state.questions.length;
  return (
    <Surface insets={insets} chromeTop={chromeTop} testID="trivia-phone-reveal">
      <Logo width={170} on="light" />
      <CosmicText weight="black" size={16} align="center">{progress}</CosmicText>
      {verdict === undefined ? (
        <>
          <Enter reduceMotion={reduceMotion}>
            <CosmicText weight="black" size={34} align="center" accessibilityRole="header" style={styles.heading}>Eyes on the TV!</CosmicText>
          </Enter>
          <Mascot pose="point" width={200} reduceMotion={reduceMotion} />
          <CosmicText size={17} align="center" style={{ marginTop: 6 }}>The answer and scores are on the TV.</CosmicText>
        </>
      ) : (
        <>
          {/* Only this phone's own outcome: the TV is showing everyone's. */}
          <Enter reduceMotion={reduceMotion} scale={0.88} from={0} testID="trivia-phone-verdict">
            <View style={[styles.verdictBadge, { backgroundColor: verdict ? cosmic.turquoise : cosmic.coral }]}>
              <CosmicText weight="black" size={30} align="center" accessibilityRole="header">
                {verdict ? 'You got it!' : 'Not this time'}
              </CosmicText>
            </View>
          </Enter>
          <Mascot pose={verdict ? 'celebrate' : 'point'} width={190} reduceMotion={reduceMotion} />
          <CosmicText size={17} align="center" style={{ marginTop: 6 }}>
            {verdict ? 'Nice one. See how everyone did on the TV.' : 'The answer and scores are on the TV.'}
          </CosmicText>
        </>
      )}
      <Pill style={[styles.pill, styles.nextPill]} testID="trivia-phone-next-clock">
        <View style={styles.clockRow} accessible accessibilityLabel={`${last ? 'Final scores' : 'Next question'} in ${seconds} seconds`}>
          <CosmicText weight="bold" size={18}>{last ? 'Final scores in ' : 'Next question in '}</CosmicText>
          <CosmicText weight="black" size={24}>{`${seconds}s`}</CosmicText>
        </View>
      </Pill>
      {isHost ? (
        <>
          <CosmicText size={15} color={cosmic.muted} align="center" style={{ marginTop: 12 }}>
            {last ? 'Seen enough?' : 'Ready for the next one?'}
          </CosmicText>
          <PressScale
            onPress={onNext}
            reduceMotion={reduceMotion}
            accessibilityLabel={last ? 'Show final scores' : 'Next question'}
            testID="trivia-phone-next"
            style={styles.nextButton}
          >
            <CosmicText weight="black" size={22}>{last ? 'Show final scores' : 'Next question'}</CosmicText>
          </PressScale>
        </>
      ) : (
        <CosmicText size={15} color={cosmic.muted} align="center" style={{ marginTop: 12 }}>The host can move on sooner.</CosmicText>
      )}
    </Surface>
  );
}

function EyesUp({
  insets,
  chromeTop,
  pose,
  line,
  reduceMotion,
  testID,
}: {
  readonly insets: PhoneSafeAreaInsets;
  readonly chromeTop: number;
  readonly pose: MascotPose;
  readonly line: string;
  readonly reduceMotion: boolean | undefined;
  readonly testID: string;
}) {
  return (
    <Surface insets={insets} chromeTop={chromeTop} testID={testID}>
      <Logo width={190} on="light" />
      <CosmicText weight="black" size={34} align="center" accessibilityRole="header" style={styles.heading}>Eyes up.</CosmicText>
      <Mascot pose={pose} width={200} reduceMotion={reduceMotion} />
      <CosmicText size={17} align="center">{line}</CosmicText>
    </Surface>
  );
}

function Header({ progress, seconds }: { readonly progress: string; readonly seconds: number }) {
  return (
    <View style={styles.header}>
      <Logo width={120} on="light" />
      <View style={styles.headerRow}>
        <CosmicText weight="black" size={17} accessibilityLabel={`Question ${progress.replace(' / ', ' of ')}`}>{progress}</CosmicText>
        <Pill style={styles.timer} testID="trivia-phone-clock">
          <CosmicText weight="black" size={22} accessibilityLabel={`${seconds} seconds remaining`}>{timerLabel(seconds)}</CosmicText>
        </Pill>
      </View>
    </View>
  );
}

function AnswerButton({
  option,
  reduceMotion,
  onPress,
}: {
  readonly option: AnswerOption;
  readonly reduceMotion: boolean | undefined;
  readonly onPress: () => void;
}) {
  const open = option.state === 'open';
  return (
    <PressScale
      onPress={onPress}
      disabled={!open}
      reduceMotion={reduceMotion}
      accessibilityLabel={`${String.fromCharCode(65 + option.optionIndex)}: ${option.text}`}
      accessibilityState={{ disabled: !open, selected: option.state === 'lockedIn' }}
      testID={`trivia-answer-${option.optionIndex}`}
      style={[styles.answer, { backgroundColor: answerTone(option.optionIndex) }, option.state === 'closed' ? styles.answerClosed : null]}
    >
      <LetterBadge optionIndex={option.optionIndex} size={46} />
      <CosmicText weight="black" size={option.text.length > 26 ? 18 : 22} numberOfLines={2} style={styles.answerText}>
        {option.text}
      </CosmicText>
    </PressScale>
  );
}

/** A pressable that squashes slightly under the finger; still with reduced motion. */
function PressScale({
  children,
  onPress,
  disabled = false,
  reduceMotion,
  accessibilityLabel,
  accessibilityState,
  testID,
  style,
}: {
  readonly children: ReactNode;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly reduceMotion: boolean | undefined;
  readonly accessibilityLabel: string;
  readonly accessibilityState?: { readonly disabled?: boolean; readonly selected?: boolean };
  readonly testID?: string;
  readonly style?: object;
}) {
  const scale = useState(() => new Animated.Value(1))[0];
  const to = (value: number) => {
    if (reduceMotion !== false) return;
    // Feedback the instant the finger lands; the release settles without a wobble.
    Animated.timing(scale, {
      toValue: value,
      duration: value === 1 ? COSMIC_MOTION.release : COSMIC_MOTION.press,
      easing: cosmicEaseOut,
      useNativeDriver: true,
    }).start();
  };
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState ?? { disabled }}
      testID={testID}
      style={styles.pressable}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** The cream answer pad: safe-area padding, a few twinkles, centred content. */
function Surface({
  insets,
  chromeTop,
  children,
  testID,
  scrollTestID,
  align = 'center',
}: {
  readonly insets: PhoneSafeAreaInsets;
  readonly chromeTop: number;
  readonly children: ReactNode;
  readonly testID: string;
  readonly scrollTestID?: string;
  readonly align?: 'center' | 'stretch';
}) {
  return (
    <View style={styles.screen} testID={testID}>
      <StatusBar barStyle="dark-content" backgroundColor={cosmic.cream} />
      <Twinkle size={22} style={{ left: 28, top: insets.top + 90 }} />
      <Twinkle size={18} style={{ right: 32, top: insets.top + 60 }} />
      <Twinkle size={16} style={{ right: 40, top: '55%' }} />
      <Twinkle size={20} style={{ left: 30, bottom: insets.bottom + 120 }} />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingLeft: insets.left,
            paddingRight: insets.right,
            paddingTop: insets.top + chromeTop + 16,
            paddingBottom: insets.bottom + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
        testID={scrollTestID}
      >
        {align === 'stretch' ? (
          <View style={[styles.page, styles.pageStretch]}>{children}</View>
        ) : (
          // A short stack sits about a third of the way down, not dead centre,
          // so the screen does not look empty above and below it.
          <View style={styles.page}>
            <View style={styles.spaceAbove} />
            {children}
            <View style={styles.spaceBelow} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * This phone's own place, ranked like the TV podium: equal scores share a
 * place and use up the ones below (1, 1, 3). Standings are already shared
 * with every phone, so nothing new leaves the server.
 */
function finishingPlace(state: PlayableTriviaState, playerId: string) {
  const own = state.standings.find((standing) => standing.playerId === playerId);
  if (!own) return undefined;
  const ahead = state.standings.filter((standing) => standing.score > own.score).length;
  const level = state.standings.filter((standing) => standing.score === own.score).length;
  return { rank: ahead + 1, of: state.standings.length, score: own.score, shared: level > 1 };
}

function ordinal(rank: number): string {
  const tens = rank % 100;
  if (tens >= 11 && tens <= 13) return `${rank}th`;
  return `${rank}${['th', 'st', 'nd', 'rd'][rank % 10] ?? 'th'}`;
}

const ZERO_INSETS: PhoneSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

function finiteInset(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : 0;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: cosmic.cream },
  scroll: { flexGrow: 1 },
  page: { flexGrow: 1, width: '100%', maxWidth: 480, alignSelf: 'center', alignItems: 'center', paddingHorizontal: 24, gap: 8 },
  spaceAbove: { flexGrow: 1 },
  spaceBelow: { flexGrow: 1.8 },
  pageStretch: { alignItems: 'stretch', justifyContent: 'flex-start' },
  heading: { marginVertical: 8 },
  pill: { paddingHorizontal: 22, paddingVertical: 8, marginTop: 8 },
  header: { alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 2 },
  timer: { paddingHorizontal: 16, paddingVertical: 4, minWidth: 74 },
  categoryChip: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 4, marginTop: 12 },
  question: { marginTop: 10, marginBottom: 16 },
  answers: { gap: 12 },
  answer: { minHeight: 68, borderRadius: 24, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 16 },
  answerClosed: { opacity: 0.45 },
  answerText: { flex: 1 },
  placeCard: { alignItems: 'center', borderRadius: 28, paddingHorizontal: 36, paddingVertical: 12, marginBottom: 14 },
  verdictBadge: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 999, marginVertical: 8 },
  nextPill: { marginTop: 16, paddingHorizontal: 26, paddingVertical: 12, alignSelf: 'stretch' },
  nextButton: { marginTop: 8, minHeight: 56, borderRadius: 999, backgroundColor: cosmic.turquoise, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', paddingHorizontal: 32 },
  pressable: { alignSelf: 'stretch' },
  clockRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  rule: { alignSelf: 'stretch', height: 1, backgroundColor: 'rgba(4,27,57,0.12)', marginVertical: 14 },
});
