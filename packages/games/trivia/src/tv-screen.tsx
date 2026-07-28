import type { TvGameScreenProps } from '@huddle/game-core';
import {
  accentFace,
  borderWidth,
  colors,
  fontFamily,
  letterSpacing,
  opacity,
  playerFace,
  radius,
  shadowDepth,
} from '@huddle/ui';
import { StickerSurface } from '@huddle/ui/native';
import { StyleSheet, Text, View } from 'react-native';

import type { TriviaState } from './logic';
import {
  watchedScreen,
  type PlayerVerdict,
  type ScoreRow,
  type WatchedOption,
} from './watching';

/**
 * Trivia on the television: the question, the reveal, and the scoreboard.
 *
 * Everything drawn here comes from `watchedScreen`, which is where what the TV
 * shows is decided and tested; this file only draws it (docs/tech-stack.md).
 * The television sends nothing and holds no player record — it is given the
 * room's state and its roster, and is a pure function of the two.
 */

/** One of the four options, in the accent the phone drew it in. */
function Option({ option }: { readonly option: WatchedOption }) {
  const face = accentFace(option.optionIndex);
  // Before the reveal `correct` is `undefined` and every option is drawn the
  // same. After it, the wrong ones step back rather than being marked wrong:
  // the eye should land on the right answer, not audit the other three.
  const revealed = option.correct !== undefined;

  return (
    <StickerSurface
      depth={shadowDepth.tvCard}
      style={[styles.option, { backgroundColor: face.fill }]}
      wrapperStyle={[styles.optionBlock, revealed && !option.correct && styles.optionWrong]}
    >
      <Text style={[styles.optionText, { color: face.label }]}>{option.text}</Text>
      {option.correct === true ? <Text style={styles.optionTick}>✓</Text> : null}
    </StickerSurface>
  );
}

/**
 * A player's name in their claimed color.
 *
 * Deliberately not called a Seat: a Seat is the TV roster's place in the lobby,
 * a dashed circle until somebody takes it (docs/CONTEXT.md). This is a name on
 * a scoreboard row, and reusing that word for it would put two things behind
 * one term.
 */
function NamePill({ nickname, color }: { readonly nickname: string; readonly color: ScoreRow['color'] }) {
  const face = playerFace(color);

  return (
    <View style={[styles.namePill, { backgroundColor: face.fill }]}>
      <Text style={[styles.namePillText, { color: face.monogram }]}>{nickname}</Text>
    </View>
  );
}

function VerdictRow({ verdict }: { readonly verdict: PlayerVerdict }) {
  return (
    <View style={styles.verdict}>
      <NamePill nickname={verdict.nickname} color={verdict.color} />
      <Text style={styles.verdictMark}>{verdict.correct ? '✓' : '✗'}</Text>
    </View>
  );
}

function Scoreboard({ rows }: { readonly rows: readonly ScoreRow[] }) {
  return (
    <View style={styles.scoreboard}>
      {rows.map((row) => (
        <View key={row.playerId} style={styles.scoreRow}>
          <NamePill nickname={row.nickname} color={row.color} />
          <Text style={styles.score}>{row.score}</Text>
        </View>
      ))}
    </View>
  );
}

/** "Question 2 of 3" — where the room is in the set. */
function QuestionCount({ at, of }: { readonly at: number; readonly of: number }) {
  return (
    <StickerSurface depth={shadowDepth.phoneSmall} style={styles.chip}>
      <Text style={styles.chipText}>
        QUESTION {at} OF {of}
      </Text>
    </StickerSurface>
  );
}

export function TriviaTvScreen({ state, players }: TvGameScreenProps<TriviaState>) {
  const screen = watchedScreen(state, players);

  if (screen.kind === 'finished') {
    // The Victory Screen proper — the winner celebrated, ties sharing the top
    // rank — is its own task. This is the scoreboard, standing in.
    return (
      <View style={styles.stage}>
        <Text style={styles.question}>Final scores</Text>
        <Scoreboard rows={screen.scoreboard} />
      </View>
    );
  }

  return (
    <View style={styles.stage}>
      <View style={styles.header}>
        <QuestionCount at={screen.questionNumber} of={screen.questionCount} />
        {screen.kind === 'question' ? (
          <StickerSurface depth={shadowDepth.phoneSmall} style={styles.answeredChip}>
            <Text style={styles.chipText}>
              {screen.answered}/{screen.playerCount} ANSWERED
            </Text>
          </StickerSurface>
        ) : null}
      </View>

      <Text style={styles.question}>{screen.text}</Text>

      <View style={styles.options}>
        {screen.options.map((option) => (
          <Option key={option.optionIndex} option={option} />
        ))}
      </View>

      {screen.kind === 'reveal' ? (
        <View style={styles.revealFoot}>
          <View style={styles.verdicts}>
            {screen.verdicts.map((verdict) => (
              <VerdictRow key={verdict.playerId} verdict={verdict} />
            ))}
          </View>
          <Scoreboard rows={screen.scoreboard} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 24,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  answeredChip: {
    backgroundColor: colors.yellow,
    borderColor: colors.ink,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  chipText: {
    color: colors.ink,
    fontFamily: fontFamily.bodyBold,
    fontSize: 20,
    letterSpacing: letterSpacing.badge,
  },
  question: {
    color: colors.ink,
    fontFamily: fontFamily.display,
    fontSize: 44,
    textAlign: 'center',
  },
  options: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    justifyContent: 'center',
  },
  optionBlock: {
    // Two across on a television, which keeps the option text large enough to
    // read from a sofa.
    width: '46%',
  },
  optionWrong: {
    opacity: opacity.unavailable,
  },
  option: {
    alignItems: 'center',
    borderColor: colors.ink,
    borderRadius: radius.cardLarge,
    borderWidth: borderWidth.thick,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    minHeight: 96,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  optionText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 30,
    textAlign: 'center',
  },
  optionTick: {
    color: colors.ink,
    fontFamily: fontFamily.display,
    fontSize: 30,
  },
  revealFoot: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 48,
    justifyContent: 'center',
  },
  verdicts: {
    gap: 10,
  },
  verdict: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  verdictMark: {
    color: colors.ink,
    fontFamily: fontFamily.display,
    fontSize: 24,
  },
  scoreboard: {
    gap: 10,
  },
  scoreRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  namePill: {
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  namePillText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 22,
  },
  score: {
    color: colors.ink,
    fontFamily: fontFamily.display,
    fontSize: 26,
    minWidth: 72,
    textAlign: 'right',
  },
});
