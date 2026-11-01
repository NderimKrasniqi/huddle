import type { PhoneSafeAreaInsets } from '@huddle/domain';
import { StyleSheet, View } from 'react-native';

import { cosmic, CosmicText, Enter, Logo, Mascot } from './cosmic';
import { phoneStyles, PressScale, Surface } from './phone-frame';
import type { TriviaState } from './types';

type RevealVerdict = 'right' | 'wrong' | 'missed';

const VERDICT_COPY: Readonly<Record<RevealVerdict, { readonly title: string; readonly line: string; readonly tone: string }>> = {
  right: { title: 'You got it!', line: 'Nice one. See how everyone did on the TV.', tone: cosmic.turquoise },
  wrong: { title: 'Not this time', line: 'The answer and scores are on the TV.', tone: cosmic.coral },
  missed: { title: 'Out of time', line: 'No answer this round. The next one is yours.', tone: cosmic.butter },
};

function verdictLine(verdict: RevealVerdict, last: boolean): string {
  return verdict === 'missed' && last ? 'No answer on the last one. Final scores are next.' : VERDICT_COPY[verdict].line;
}

export function revealVerdict(state: TriviaState, playerId: string): RevealVerdict | undefined {
  const right = state.revealVerdicts?.[playerId];
  if (right === undefined) return undefined;
  if (right) return 'right';
  return state.revealAnswered?.[playerId] === false ? 'missed' : 'wrong';
}

export function RevealSurface({
  insets,
  chromeTop,
  state,
  verdict,
  progress,
  seconds,
  isHost,
  hostNickname,
  reduceMotion,
  onNext,
}: {
  readonly hostNickname?: string;
  readonly insets: PhoneSafeAreaInsets;
  readonly chromeTop: number;
  readonly state: TriviaState;
  readonly verdict: RevealVerdict | undefined;
  readonly progress: string;
  readonly seconds: number;
  readonly isHost: boolean;
  readonly reduceMotion: boolean | undefined;
  readonly onNext: () => void;
}) {
  const last = state.questionIndex + 1 >= state.questions.length;
  return (
    <Surface insets={insets} chromeTop={chromeTop} testID="trivia-phone-reveal">
      <Logo width={130} on="light" />
      <CosmicText weight="black" size={16} align="center">{progress}</CosmicText>
      {verdict === undefined ? (
        <>
          <Enter reduceMotion={reduceMotion}>
            <CosmicText weight="black" size={36} align="center" accessibilityRole="header" style={phoneStyles.heading}>Eyes on the TV!</CosmicText>
          </Enter>
          <Mascot pose="point" width={200} reduceMotion={reduceMotion} />
          <CosmicText size={16} align="center" style={{ marginTop: 6 }}>The answer and scores are on the TV.</CosmicText>
        </>
      ) : (
        <>
          <Enter reduceMotion={reduceMotion} scale={0.88} from={0} testID="trivia-phone-verdict">
            <View style={[styles.verdictBadge, { backgroundColor: VERDICT_COPY[verdict].tone }]}>
              <CosmicText weight="black" size={28} align="center" accessibilityRole="header">
                {VERDICT_COPY[verdict].title}
              </CosmicText>
            </View>
          </Enter>
          <Mascot pose={verdict === 'right' ? 'celebrate' : 'point'} width={190} reduceMotion={reduceMotion} />
          <CosmicText size={16} align="center" style={{ marginTop: 6 }}>
            {verdictLine(verdict, last)}
          </CosmicText>
        </>
      )}
      <View style={styles.clockRow} accessible accessibilityLabel={`${last ? 'Final scores' : 'Next question'} in ${seconds} seconds`} testID="trivia-phone-next-clock">
        <CosmicText weight="bold" size={18} color={cosmic.muted}>{last ? 'Final scores in ' : 'Next question in '}</CosmicText>
        <CosmicText weight="black" size={22}>{`${seconds}s`}</CosmicText>
      </View>
      {isHost ? (
        <>
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
        <CosmicText size={16} color={cosmic.muted} align="center" style={{ marginTop: 12 }}>{`${hostNickname ?? 'The host'} can move on sooner.`}</CosmicText>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  verdictBadge: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 999, marginVertical: 8 },
  nextButton: { marginTop: 8, minHeight: 56, borderRadius: 999, backgroundColor: cosmic.turquoise, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', paddingHorizontal: 32 },
  clockRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginTop: 16 },
});
