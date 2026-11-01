import { AvatarPortrait } from '@huddle/ui/game-kit';
import { StyleSheet, View } from 'react-native';

import { answerTone, CheckBadge, cosmic, cosmicWash, CosmicText, COSMIC_MOTION, CountUp, Enter, LetterBadge, Mascot, MissBadge, Pill, Pulse } from './cosmic';
import { optionAccessibilityLabel, panel, SAFE_X, SAFE_Y, stageStyles } from './tv-stage';
import type { WatchedScreen } from './watching';

function tallyQuip(right: number, total: number): string | undefined {
  if (total < 2) return undefined;
  if (right === total) return 'Big brains all round!';
  if (right === 0) return 'Nobody saw that coming!';
  if (right === 1) return 'A lone genius walks among us.';
  return undefined;
}

export function RevealStage({
  screen,
  seconds,
  reduceMotion,
  hostNickname,
}: {
  readonly screen: Extract<WatchedScreen, { kind: 'reveal' }>;
  readonly seconds: number;
  readonly reduceMotion: boolean | undefined;
  readonly hostNickname?: string;
}) {
  const correct = screen.options.find((option) => option.correct === true);
  const last = screen.questionNumber >= screen.questionCount;
  const compact = screen.scoreboard.length > 5;
  const roomy = screen.scoreboard.length <= 4;
  const anyGain = screen.scoreboard.some((row) => row.gain !== undefined && row.gain > 0);
  const gotIt = screen.verdicts.filter((verdict) => verdict.correct).length;
  const verdictOf = (playerId: string) => screen.verdicts.find((verdict) => verdict.playerId === playerId)?.correct === true;

  return (
    <View style={StyleSheet.absoluteFill} accessible accessibilityRole="text" accessibilityLabel={revealAccessibilityLabel(screen, seconds)}>
      <CosmicText weight="extraBold" size={40} color={cosmic.cream} tracking={7} align="center" style={stageStyles.topLabel}>
        {`THE REVEAL • ${screen.questionNumber} / ${screen.questionCount}`}
      </CosmicText>
      <View style={styles.revealRow}>
        <Enter reduceMotion={reduceMotion} style={styles.answerPanel}>
          <CosmicText weight="black" size={56} align="center" numberOfLines={1}>Correct answer</CosmicText>
          <CosmicText weight="extraBold" size={40} align="center" numberOfLines={4} style={{ marginTop: 28 }}>
            {screen.text}
          </CosmicText>
          {correct ? (
            <Enter reduceMotion={reduceMotion} delay={350} scale={0.9} from={0} style={{ alignSelf: 'stretch', marginTop: 36 }}>
              <Pulse reduceMotion={reduceMotion} delay={350 + COSMIC_MOTION.enter}>
                <View style={[styles.correctTile, { backgroundColor: answerTone(correct.optionIndex) }]}>
                  <LetterBadge optionIndex={correct.optionIndex} size={72} />
                  <CosmicText weight="black" size={correctAnswerSize(correct.text)} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7} style={stageStyles.answerText}>
                    {correct.text}
                  </CosmicText>
                  <CheckBadge size={56} />
                </View>
              </Pulse>
            </Enter>
          ) : null}
          <Enter reduceMotion={reduceMotion} delay={700} from={10} style={styles.tally} testID="trivia-tv-tally">
            <View style={styles.tallyRow}>
              <CosmicText weight="black" size={64} color={cosmic.correct}>{gotIt}</CosmicText>
              <CosmicText weight="extraBold" size={30}>{` of ${screen.verdicts.length} got it right`}</CosmicText>
            </View>
            {tallyQuip(gotIt, screen.verdicts.length) ? (
              <CosmicText weight="bold" size={30} color={cosmic.muted} align="center">{tallyQuip(gotIt, screen.verdicts.length)}</CosmicText>
            ) : null}
          </Enter>
        </Enter>
        <Enter reduceMotion={reduceMotion} delay={120} style={styles.resultsPanel}>
          <CosmicText weight="black" size={72} align="center">Round results</CosmicText>
          <View style={[styles.resultRows, compact ? styles.resultRowsCompact : null, roomy ? styles.resultRowsRoomy : null]} testID="trivia-tv-verdict-grid">
            {screen.scoreboard.map((row, index) => {
              const right = verdictOf(row.playerId);
              return (
                <Enter key={row.playerId} reduceMotion={reduceMotion} delay={150 + index * 40} from={14} style={[styles.resultRow, compact ? styles.resultRowCompact : null]} testID={`trivia-tv-verdict-row-${row.playerId}`}>
                  {row.avatar ? <AvatarPortrait avatarId={row.avatar} displayName={row.nickname} size={compact ? 48 : roomy ? 84 : 72} disabled={row.away} /> : null}
                  <CosmicText weight="bold" size={compact ? 30 : roomy ? 40 : 40} numberOfLines={1} style={styles.resultName}>{row.nickname}</CosmicText>
                  <View style={[styles.verdict, compact ? styles.verdictCompact : null, roomy ? styles.verdictRoomy : null]}>
                    {right ? <CheckBadge size={compact ? 40 : roomy ? 56 : 40} /> : <MissBadge size={compact ? 40 : roomy ? 56 : 40} />}
                    {compact ? null : (
                      <CosmicText weight="extraBold" size={roomy ? 40 : 30} color={right ? cosmic.correct : cosmic.missed}>
                        {right ? 'Correct' : 'Missed'}
                      </CosmicText>
                    )}
                  </View>
                  {compact ? (
                    anyGain ? (
                      <View style={styles.gainSlotCompact} testID="trivia-tv-gain-slot">
                        {row.gain !== undefined && row.gain > 0 ? (
                          <Enter reduceMotion={reduceMotion} delay={350 + index * 40} scale={0.85} from={0}>
                            <Pill color={cosmic.butter} style={styles.gainPillCompact}>
                              <CosmicText weight="black" size={24}>{`+${row.gain}`}</CosmicText>
                            </Pill>
                          </Enter>
                        ) : null}
                      </View>
                    ) : null
                  ) : row.gain !== undefined && row.gain > 0 ? (
                    <Enter reduceMotion={reduceMotion} delay={350 + index * 40} scale={0.85} from={0}>
                      <Pill color={cosmic.butter} style={styles.gainPill}>
                        <CosmicText weight="black" size={roomy ? 30 : 24}>{`+${row.gain}`}</CosmicText>
                      </Pill>
                    </Enter>
                  ) : null}
                  <CountUp
                    from={row.score - (row.gain ?? 0)}
                    to={row.score}
                    delay={400 + index * 40}
                    reduceMotion={reduceMotion}
                    weight="black"
                    size={compact ? 30 : roomy ? 40 : 40}
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
          <View style={stageStyles.clockRow}>
            <CosmicText weight="extraBold" size={40}>{last ? 'Final scores in ' : 'Next question in '}</CosmicText>
            <CosmicText weight="black" size={56}>{`${seconds}s`}</CosmicText>
          </View>
        </Pill>
        <CosmicText weight="bold" size={30} color={cosmic.cream} align="center" style={styles.nextHint}>{`${hostNickname ?? 'The host'} can move on sooner`}</CosmicText>
      </View>
      <Mascot pose="celebrate" width={220} reduceMotion={reduceMotion} style={stageStyles.revealMascot} />
    </View>
  );
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

function correctAnswerSize(text: string): number {
  const longestWord = Math.max(...text.split(/\s+/).map((word) => word.length));
  if (text.length <= 7) return 54;
  if (longestWord <= 10 && text.length <= 16) return 40;
  if (longestWord > 12) return 28;
  return 34;
}

const styles = StyleSheet.create({
  revealRow: { position: 'absolute', top: 220, left: SAFE_X, right: SAFE_X, bottom: 200, flexDirection: 'row', gap: 40 },
  answerPanel: { ...panel, width: 560, paddingHorizontal: 44, paddingVertical: 48, alignItems: 'center' },
  correctTile: { borderRadius: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 22, gap: 20 },
  tally: { marginTop: 'auto', alignItems: 'center', gap: 4 },
  tallyRow: { flexDirection: 'row', alignItems: 'baseline' },
  resultsPanel: { ...panel, flex: 1, paddingHorizontal: 40, paddingTop: 36, paddingBottom: 28 },
  resultRows: { marginTop: 18, gap: 10 },
  resultRowsRoomy: { flex: 1, justifyContent: 'center', gap: 18, marginTop: 0 },
  resultRowsCompact: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, columnGap: 24 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: cosmicWash.rowTint },
  resultRowCompact: { width: 510, gap: 8, paddingVertical: 4 },
  resultName: { flex: 1 },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 12, width: 200 },
  verdictCompact: { width: 38 },
  verdictRoomy: { width: 250 },
  resultScore: { width: 110 },
  gainPill: { paddingHorizontal: 14, paddingVertical: 2 },
  gainSlotCompact: { minWidth: 72, alignItems: 'flex-end' },
  gainPillCompact: { paddingHorizontal: 10, paddingVertical: 0 },
  resultScoreCompact: { width: 76 },
  nextBar: { position: 'absolute', left: 0, right: 0, bottom: SAFE_Y + 4, alignItems: 'center' },
  nextHint: { alignSelf: 'stretch', marginTop: 10 },
  nextPill: { paddingHorizontal: 52, paddingVertical: 12 },
});
