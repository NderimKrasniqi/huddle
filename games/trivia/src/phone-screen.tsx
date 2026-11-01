import { useCountdownSeconds, useOncePerKey, useSystemReducedMotion } from '@huddle/ui/game-kit';
import type { PhoneGameScreenProps, PhoneSafeAreaInsets } from '@huddle/domain';
import { StyleSheet, View } from 'react-native';

import { answerScreen, type AnswerOption } from './answering';
import { answerTone, cosmic, CosmicText, Enter, LetterBadge, LockMark, Logo, Mascot, type MascotPose, Pill } from './cosmic';
import { Header, phoneStyles, PressScale, Surface } from './phone-frame';
import { RevealSurface, revealVerdict } from './phone-reveal';
import { QUESTION_SECONDS, REVEAL_SECONDS } from './state';
import type { TriviaEvent, TriviaState } from './types';

export function TriviaPhoneScreen({
  state,
  player,
  sendEvent,
  safeAreaInsets,
  hostChromeInsetTop,
  hostChromeInsetBottom,
  clockRemainingMs,
  isHost = false,
  feedback,
  hostNickname,
}: PhoneGameScreenProps<TriviaState, TriviaEvent>) {
  const reduceMotion = useSystemReducedMotion();
  const device = safeAreaInsets ?? ZERO_INSETS;
  const insets = { ...device, bottom: device.bottom + finiteInset(hostChromeInsetBottom) };
  const chromeTop = finiteInset(hostChromeInsetTop);
  const current = state;
  const seconds = useCountdownSeconds(
    current.phase === 'question' || current.phase === 'reveal' ? clockRemainingMs : undefined,
    current.phase === 'question' ? current.questionSeconds ?? QUESTION_SECONDS : current.phase === 'reveal' ? REVEAL_SECONDS : 0,
    `${current.questionIndex}:${current.phase}`,
  );
  const frame = { insets, chromeTop };
  const ownVerdict = current.phase === 'reveal' ? revealVerdict(current, player.playerId) : undefined;
  const verdictKey = ownVerdict === undefined ? undefined : `${current.questionIndex}:${ownVerdict}`;
  useOncePerKey(verdictKey, () => {
    feedback?.(verdictKey?.endsWith(':right') === true ? 'success' : 'error');
  });

  const count = current.questions.length;

  if (current.phase === 'intro') {
    return (
      <Surface {...frame} testID="trivia-phone-intro">
        <Logo width={200} on="light" />
        <Enter reduceMotion={reduceMotion}>
          <CosmicText weight="black" size={40} align="center" accessibilityRole="header" style={phoneStyles.heading}>Get ready!</CosmicText>
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
          <CosmicText weight="black" size={36} align="center" accessibilityRole="header" style={phoneStyles.heading}>Answer locked!</CosmicText>
        </Enter>
        <Enter reduceMotion={reduceMotion} scale={0.88} from={0} delay={80}>
          <LockMark size={150} />
        </Enter>
        <Enter reduceMotion={reduceMotion} delay={160} style={{ alignItems: 'center' }}>
          {answered !== undefined ? (
            <CosmicText weight="bold" size={20} align="center" style={{ marginTop: 28 }}>
              {`${answered} of ${current.standings.length} answered`}
            </CosmicText>
          ) : null}
          <CosmicText size={16} color={cosmic.muted} align="center" style={{ marginTop: 4 }}>Waiting for others…</CosmicText>
          <Mascot pose="point" width={190} reduceMotion={reduceMotion} style={{ marginTop: 40 }} />
        </Enter>
      </Surface>
    );
  }

  if (model.kind === 'question') {
    return (
      <Surface {...frame} testID="trivia-phone-screen" scrollTestID="trivia-phone-scroll" align="stretch">
        <Header progress={progress} seconds={seconds} />
        <View style={styles.questionArea}>
          {model.category ? (
            <Pill color={cosmic.turquoise} style={styles.categoryChip} testID="trivia-phone-category">
              <CosmicText weight="black" size={13} tracking={1.5}>{model.category.toUpperCase()}</CosmicText>
            </Pill>
          ) : null}
          <CosmicText weight="black" size={22} align="center" accessibilityRole="header" style={styles.question}>
            {model.text}
          </CosmicText>
        </View>
        <View style={styles.answers}>
          {model.options.map((option, index) => (
            <Enter key={option.optionIndex} reduceMotion={reduceMotion} delay={index * 60} from={16}>
              <AnswerButton
                option={option}
                reduceMotion={reduceMotion}
                onPress={() => {
                  feedback?.('select');
                  sendEvent({
                    kind: 'answer',
                    playerId: player.playerId,
                    questionIndex: model.questionIndex,
                    optionIndex: option.optionIndex,
                  });
                }}
              />
            </Enter>
          ))}
        </View>
        <CosmicText size={16} color={cosmic.muted} align="center" style={{ marginTop: 14 }}>
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
        verdict={revealVerdict(current, player.playerId)}
        progress={progress}
        seconds={seconds}
        isHost={isHost}
        hostNickname={hostNickname}
        reduceMotion={reduceMotion}
        onNext={() =>
          sendEvent({ kind: 'advance', playerId: player.playerId, questionIndex: current.questionIndex, phase: 'reveal' })
        }
      />
    );
  }

  if (current.phase === 'finished') {
    const place = finishingPlace(current, player.playerId);
    const won = place?.rank === 1;
    return (
      <Surface {...frame} testID="trivia-phone-finished" scrollTestID="trivia-phone-finished-scroll">
        <Logo width={130} on="light" />
        <Pill color={cosmic.turquoise} style={styles.pill}>
          <CosmicText weight="black" size={16} tracking={1.5}>GAME COMPLETE</CosmicText>
        </Pill>
        <Enter reduceMotion={reduceMotion}>
          <CosmicText weight="black" size={36} align="center" accessibilityRole="header" style={phoneStyles.heading}>
            {won ? (place.shared ? 'It’s a tie!' : 'You won!') : 'That’s a wrap!'}
          </CosmicText>
        </Enter>
        <Mascot pose="celebrate" width={210} reduceMotion={reduceMotion} />
        {place ? (
          <Enter reduceMotion={reduceMotion} delay={250} scale={0.85} from={0} testID="trivia-phone-place">
            <View style={[styles.placeCard, { backgroundColor: won ? cosmic.butter : cosmic.periwinkle }]}>
              <CosmicText weight="black" size={40}>{ordinal(place.rank)}</CosmicText>
              <CosmicText weight="bold" size={16}>
                of {place.of} · {place.score} {place.score === 1 ? 'point' : 'points'}
              </CosmicText>
            </View>
          </Enter>
        ) : null}
        <CosmicText size={16} color={cosmic.muted} align="center">
          {isHost ? 'Final scores are on the TV. Bring everyone back when you’re ready.' : `Final scores are on the TV. ${hostNickname ?? 'The host'} chooses what’s next.`}
        </CosmicText>
      </Surface>
    );
  }

  return <EyesUp {...frame} pose="point" line={model.kind === 'eyesUp' ? model.line : ''} reduceMotion={reduceMotion} testID={`trivia-phone-${current.phase}`} />;
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
      <CosmicText weight="black" size={36} align="center" accessibilityRole="header" style={phoneStyles.heading}>Eyes up.</CosmicText>
      <Mascot pose={pose} width={200} reduceMotion={reduceMotion} />
      <CosmicText size={16} align="center">{line}</CosmicText>
    </Surface>
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
      <CosmicText weight="black" size={option.text.length > 28 ? 18 : 22} numberOfLines={2} style={styles.answerText}>
        {option.text}
      </CosmicText>
    </PressScale>
  );
}

function finishingPlace(state: TriviaState, playerId: string) {
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
  pill: { paddingHorizontal: 22, paddingVertical: 8, marginTop: 8 },
  categoryChip: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 4, marginTop: 12 },
  question: { marginTop: 10, marginBottom: 16 },
  questionArea: { flexGrow: 1, justifyContent: 'flex-start', paddingTop: 16 },
  answers: { gap: 12 },
  answer: { minHeight: 68, borderRadius: 24, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 16 },
  answerClosed: { opacity: 0.45 },
  answerText: { flex: 1 },
  placeCard: { alignItems: 'center', borderRadius: 28, paddingHorizontal: 36, paddingVertical: 12, marginBottom: 14 },
});
