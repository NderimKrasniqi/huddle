import type { TvGameScreenProps } from '@huddle/game-core';
import {
  accentFace,
  borderWidth,
  colors,
  fontFamily,
  letterSpacing,
  opacity,
  avatarFace,
  radius,
  elevation,
} from '@huddle/ui';
import { Surface } from '@huddle/ui/native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { TriviaState } from './logic';
import {
  watchedScreen,
  type FinalStanding,
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
    <Surface
      elevation={elevation.tvCard}
      style={[[styles.optionBlock, revealed && !option.correct && styles.optionWrong], [styles.option, { backgroundColor: face.fill }]]}>
      <Text style={[styles.optionText, { color: face.label }]}>{option.text}</Text>
      {option.correct === true ? <Text style={styles.optionTick}>✓</Text> : null}
    </Surface>
  );
}

/**
 * A player's name in their claimed color.
 *
 * Deliberately not called a Seat: a Seat is the TV roster's place in the lobby,
 * a dashed circle until somebody takes it. This is a name on
 * a scoreboard row, and reusing that word for it would put two things behind
 * one term.
 */
function NamePill({
  nickname,
  avatar,
}: {
  readonly nickname: string;
  readonly avatar: ScoreRow['avatar'];
}) {
  const face = avatarFace(avatar);

  return (
    <View style={[styles.namePill, { backgroundColor: face.fill }]}>
      <Text style={[styles.namePillText, { color: face.ink }]}>{nickname}</Text>
    </View>
  );
}

function VerdictRow({ verdict }: { readonly verdict: PlayerVerdict }) {
  return (
    <View style={styles.verdict}>
      <NamePill nickname={verdict.nickname} avatar={verdict.avatar} />
      <Text style={styles.verdictMark}>{verdict.correct ? '✓' : '✗'}</Text>
    </View>
  );
}

/**
 * The Status Dot beside a scoreboard name: Boardwalk green while the room is
 * hearing from that phone, muted once it has gone quiet.
 *
 * The same badge the pairing roster wears on its seats, because presence is
 * news wherever a player is drawn (the Status Dot) — and here it
 * is also the answer to a question the scoreboard raises by itself: a player
 * whose score has stopped moving is either losing or away, and the room can
 * only tell from the dot.
 *
 * The dot alone: the handoff specifies presence as the dot and nothing else,
 * and the treatments the TV's seats add around it do not carry here. A seat
 * dims the avatar circle and mutes a nickname set in ink on the screen color;
 * this name is set on the player's own color, where muting the ink would leave
 * text on a fill it was never checked against and dimming the pill would take
 * the player's color down with it — the one thing on the row that says who it
 * belongs to.
 */
function StatusDot({ away }: { readonly away: boolean }) {
  return <View style={[styles.statusDot, away && styles.statusDotAway]} />;
}

function Scoreboard({ rows }: { readonly rows: readonly ScoreRow[] }) {
  return (
    <View style={styles.scoreboard}>
      {rows.map((row) => (
        <View key={row.playerId} style={styles.scoreRow}>
          <View style={styles.scoreName}>
            <StatusDot away={row.away} />
            <NamePill nickname={row.nickname} avatar={row.avatar} />
          </View>
          <Text style={styles.score}>{row.score}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * One player's finish: their place, their name, and what they scored.
 *
 * Everyone is drawn at the same size, winners included, because a room can tie
 * any number of ways — a party that answered every question wrongly ties all ten
 * seats on nothing — and a screen that grew a card per winner would run off a
 * 720px stage on a game that really happens. The celebration rides the
 * treatment instead: Boardwalk's accent offset shadow, which is how the system
 * highlights a card everywhere else (handoff, "Signature style rules"), plus
 * the headline above naming who earned it.
 */
function Placing({ standing }: { readonly standing: FinalStanding }) {
  return (
    <Surface
      elevation={standing.winner ? elevation.tvCardHighlight : elevation.tvCard}
      style={[styles.placingBlock, styles.placing]}>
      <View style={[styles.rank, standing.winner ? styles.rankWinner : null]}>
        <Text style={styles.rankText}>{standing.rank}</Text>
      </View>
      <NamePill nickname={standing.nickname} avatar={standing.avatar} />
      <Text style={[styles.score, styles.placingScore]}>{standing.score}</Text>
    </Surface>
  );
}

/**
 * The Victory Screen: the final standings with the winner
 * celebrated, and the last thing the television shows before the Host takes the
 * room back to its lobby.
 *
 * Every decision on it — the order, the ranks, who counts as a winner, and the
 * headline's words — comes from `watchedScreen`, where it can be asserted. This
 * draws them.
 */
function Victory({
  headline,
  standings,
}: {
  readonly headline: string;
  readonly standings: readonly FinalStanding[];
}) {
  return (
    <View style={styles.stage}>
      <Surface
        elevation={elevation.tvCard}
        style={[styles.finalBadgeBlock, styles.finalBadge]}>
        <Text style={styles.finalBadgeText}>FINAL SCORES</Text>
      </Surface>

      <Text style={styles.headline}>{headline}</Text>

      <View style={styles.placings}>
        {standings.map((standing) => (
          <Placing key={standing.playerId} standing={standing} />
        ))}
      </View>
    </View>
  );
}

/** "Question 2 of 3" — where the room is in the set. */
function QuestionCount({ at, of }: { readonly at: number; readonly of: number }) {
  return (
    <Surface elevation={elevation.phoneSmall} style={styles.chip}>
      <Text style={styles.chipText}>
        QUESTION {at} OF {of}
      </Text>
    </Surface>
  );
}

/**
 * The Question Timer as the room watches it run out.
 *
 * The seconds are counted here rather than read out of the room's state,
 * because the room's clock is the server's — the hub schedules the deadline
 * (`convex/convex/games.ts`) — and a television counting towards a server
 * timestamp would be counting on its own clock, which nothing holds in step
 * with the room's. So the rules say how many seconds (`countdownSeconds`) and
 * this counts them from the moment this screen was handed the question.
 *
 * That starts a round trip late, which is the safe direction: this count
 * reaches zero a moment *after* the room's does, so the reveal is what takes
 * the number off the screen rather than the number sitting at zero waiting for
 * it. Being early would be the visible bug — a countdown that hit zero while
 * four buttons were still live.
 *
 * Its `key` is the question, so a new question remounts it and the seconds
 * start over as a fact of the tree rather than through an effect that has to
 * remember to reset them.
 */
function Countdown({ seconds }: { readonly seconds: number }) {
  const [secondsLeft, setSecondsLeft] = useState(seconds);

  useEffect(() => {
    const tick = setInterval(() => {
      // Floored rather than allowed to run negative: the room may take a moment
      // past zero to say so, and a television showing "-2" would be reporting
      // its own lateness as news.
      setSecondsLeft((left) => Math.max(0, left - 1));
    }, 1000);

    return () => clearInterval(tick);
  }, []);

  return (
    <Surface
      elevation={elevation.tvCard}
      style={[styles.countdownBlock, styles.countdown]}>
      <Text style={styles.countdownText}>{secondsLeft}</Text>
    </Surface>
  );
}

export function TriviaTvScreen({ state, players }: TvGameScreenProps<TriviaState>) {
  const screen = watchedScreen(state, players);

  if (screen.kind === 'finished') {
    return <Victory headline={screen.headline} standings={screen.standings} />;
  }

  return (
    <View style={styles.stage}>
      <View style={styles.header}>
        <QuestionCount at={screen.questionNumber} of={screen.questionCount} />
        {screen.kind === 'question' ? (
          <>
            <Surface elevation={elevation.phoneSmall} style={styles.answeredChip}>
              <Text style={styles.chipText}>
                {screen.answered}/{screen.playerCount} ANSWERED
              </Text>
            </Surface>
            <Countdown key={screen.questionNumber} seconds={screen.countdownSeconds} />
          </>
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
    borderWidth: borderWidth.hairline,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  answeredChip: {
    backgroundColor: colors.soft,
    borderColor: colors.ink,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  chipText: {
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: 20,
    letterSpacing: letterSpacing.badge,
  },
  // The countdown tile, built like a Room Code tile because it is the same
  // thing on a television: one number the whole room reads at once. Tilted as
  // Boardwalk tilts cards and badges — the two chips beside it sit square, so
  // there is nothing here for the handoff's alternating siblings to alternate
  // against.
  countdownBlock: {
  },
  countdown: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderRadius: radius.card,
    borderWidth: borderWidth.hairline,
    justifyContent: 'center',
    // Wide enough for two digits, so the tile does not shrink under the number
    // as the seconds run out.
    minWidth: 88,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  countdownText: {
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontSize: 36,
  },
  question: {
    color: colors.ink,
    fontFamily: fontFamily.bold,
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
    borderWidth: borderWidth.hairline,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    minHeight: 96,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  optionText: {
    fontFamily: fontFamily.semibold,
    fontSize: 30,
    textAlign: 'center',
  },
  optionTick: {
    color: colors.ink,
    fontFamily: fontFamily.bold,
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
    fontFamily: fontFamily.bold,
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
  // The dot and the name travel together, so the row's `space-between` puts one
  // group against the score rather than spreading three things across the row.
  scoreName: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  // Boardwalk's online dot at the size the TV's pairing seats draw it: eighteen
  // across, with a 12px core inside the ink border.
  statusDot: {
    width: 18,
    height: 18,
    backgroundColor: colors.online,
    borderColor: colors.ink,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.pill,
  },
  statusDotAway: {
    backgroundColor: colors.away,
  },
  namePill: {
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  namePillText: {
    fontFamily: fontFamily.medium,
    fontSize: 22,
  },
  score: {
    color: colors.ink,
    fontFamily: fontFamily.bold,
    fontSize: 26,
    minWidth: 72,
    textAlign: 'right',
  },

  // The Victory Screen. Boardwalk's badge tilt on the label, the winner's name
  // in the largest display type on the television, and the placings under it.
  finalBadgeBlock: {
  },
  finalBadge: {
    backgroundColor: colors.accent,
    borderColor: colors.ink,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
    paddingHorizontal: 26,
    paddingVertical: 10,
  },
  finalBadgeText: {
    color: colors.surface,
    fontFamily: fontFamily.semibold,
    fontSize: 24,
    letterSpacing: letterSpacing.badge,
  },
  headline: {
    color: colors.ink,
    fontFamily: fontFamily.bold,
    fontSize: 52,
    textAlign: 'center',
  },
  placings: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    justifyContent: 'center',
  },
  // Two across, as the options are: it is as wide as the stage allows beside a
  // headline. It does not follow that ten of them fit — five rows deep runs a
  // full room tight against the 720px stage, and likely past it, as the
  // reveal's verdicts already do at that size. A screen someone has played on
  // settles that, not arithmetic here.
  placingBlock: {
    width: '46%',
  },
  placing: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderRadius: radius.row,
    borderWidth: borderWidth.hairline,
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  rank: {
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  rankWinner: {
    backgroundColor: colors.accent,
  },
  rankText: {
    color: colors.ink,
    fontFamily: fontFamily.bold,
    fontSize: 22,
  },
  // Pushed to the far end of the row, so every score on the screen lines up
  // however long the nickname beside it is.
  placingScore: {
    marginLeft: 'auto',
  },
});
