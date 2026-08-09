import type { TvGameScreenProps } from '@huddle/game-core';
import {
  accentFace,
  borderWidth,
  colors,
  fontFamily,
  letterSpacing,
  opacity,
  radius,
  elevation,
} from '@huddle/ui';
import { Surface } from '@huddle/ui/native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { VotingState } from './logic';
import { watchedVoteScreen, type PromptOption, type TallyRow } from './voting-tv';

/**
 * Voting on the television: the prompt, the tally, and the closing screen.
 *
 * Everything drawn here comes from `watchedVoteScreen`, where what the TV shows
 * is decided and tested; this file only draws it (docs/tech-stack.md). The
 * television sends nothing and holds no player record — it is given the room's
 * state and its roster, and is a pure function of the two.
 */

/** An open option: its text, in the accent the phone drew it in, no count. */
function OpenOption({ option }: { readonly option: PromptOption }) {
  const face = accentFace(option.optionIndex);

  return (
    <Surface
      elevation={elevation.tvCard}
      style={[styles.optionBlock, [styles.option, { backgroundColor: face.fill }]]}>
      <Text style={[styles.optionText, { color: face.label }]}>{option.text}</Text>
    </Surface>
  );
}

/**
 * One row of the tally: the option, its count, and a bar as long as its share
 * of the leader's.
 *
 * The bar is measured against the highest count rather than the total, so the
 * leader's bar always fills the row and the rest are read against it — the shape
 * a room glances at, rather than percentages it would have to add up. The
 * leaders wear Soft Minimal's offset shadow, the system's "look here" everywhere
 * else (docs/design/soft-minimal-handoff.md, "Signature style rules").
 */
function TallyBar({ row, highest }: { readonly row: TallyRow; readonly highest: number }) {
  const face = accentFace(row.optionIndex);
  // Empty prompts never reach a bar with a positive `highest`, so this divides
  // only when something was voted for.
  const fill = highest > 0 ? Math.max(row.count / highest, 0) : 0;

  return (
    <View style={styles.tallyRow}>
      <Surface
        elevation={row.leading ? elevation.tvCardHighlight : elevation.tvCard}
        style={[styles.tallyLabelBlock, !row.leading && row.count === 0 && styles.tallyEmpty, styles.tallyLabel]}>
        <Text style={[styles.tallyLabelText, { color: face.label, backgroundColor: face.fill }]}>
          {row.text}
        </Text>
      </Surface>

      <View style={styles.tallyTrack}>
        <View style={[styles.tallyFill, { backgroundColor: face.fill, flexGrow: fill }]} />
        <View style={{ flexGrow: 1 - fill }} />
      </View>

      <Text style={styles.tallyCount}>{row.count}</Text>
    </View>
  );
}

/** "Prompt 2 of 3" — where the room is in the set. */
function PromptCount({ at, of }: { readonly at: number; readonly of: number }) {
  return (
    <Surface elevation={elevation.phoneSmall} style={styles.chip}>
      <Text style={styles.chipText}>
        PROMPT {at} OF {of}
      </Text>
    </Surface>
  );
}

/**
 * The Vote Timer as the room watches it run out.
 *
 * Counted here rather than read out of the room's state, because the room's
 * clock is the server's — the hub schedules the deadline
 * (`convex/convex/games.ts`) — and a television counting towards a server
 * timestamp would be counting on a clock nothing holds in step with the room's.
 * So the rules say how many seconds and this counts them from the moment this
 * screen was handed the prompt. That starts a round trip late, which is the safe
 * direction: it reaches zero a moment *after* the room does, so the reveal takes
 * the number off the screen rather than it sitting at zero. Its `key` is the
 * prompt, so a new prompt remounts it and the seconds start over.
 */
function Countdown({ seconds }: { readonly seconds: number }) {
  const [secondsLeft, setSecondsLeft] = useState(seconds);

  useEffect(() => {
    const tick = setInterval(() => {
      // Floored: the room may take a moment past zero to say so, and "-2" would
      // be the television reporting its own lateness as news.
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

/**
 * The closing screen: the game is over, and the room waits for the Host to take
 * it back to the lobby.
 *
 * There is no Victory Screen here — a game of opinions has no winner — so this
 * is deliberately plain: the reveals said everything the game had to say, one
 * prompt at a time.
 */
function Wrap({ promptCount }: { readonly promptCount: number }) {
  return (
    <View style={styles.stage}>
      <Surface elevation={elevation.tvCard}
  style={[styles.finalBadgeBlock, styles.finalBadge]}>
        <Text style={styles.finalBadgeText}>THAT’S A WRAP</Text>
      </Surface>
      <Text style={styles.headline}>{promptCount} hot takes, settled.</Text>
    </View>
  );
}

export function VotingTvScreen({ state, players, clockRemainingMs }: TvGameScreenProps<VotingState>) {
  const screen = watchedVoteScreen(state, players, clockRemainingMs);

  if (screen.kind === 'finished') {
    return <Wrap promptCount={screen.promptCount} />;
  }

  if (screen.kind === 'reveal') {
    const highest = Math.max(0, ...screen.rows.map((row) => row.count));

    return (
      <View style={styles.stage}>
        <View style={styles.header}>
          <PromptCount at={screen.promptNumber} of={screen.promptCount} />
        </View>

        <Text style={styles.prompt}>{screen.text}</Text>

        <View style={styles.tally}>
          {screen.rows.map((row) => (
            <TallyBar key={row.optionIndex} row={row} highest={highest} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.stage}>
      <View style={styles.header}>
        <PromptCount at={screen.promptNumber} of={screen.promptCount} />
        <Surface elevation={elevation.phoneSmall} style={styles.votedChip}>
          <Text style={styles.chipText}>
            {screen.voted}/{screen.playerCount} VOTED
          </Text>
        </Surface>
        <Countdown key={screen.promptNumber} seconds={screen.countdownSeconds} />
      </View>

      <Text style={styles.prompt}>{screen.text}</Text>

      <View style={styles.options}>
        {screen.options.map((option) => (
          <OpenOption key={option.optionIndex} option={option} />
        ))}
      </View>
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
  votedChip: {
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
  countdownBlock: {
  },
  countdown: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderRadius: radius.card,
    borderWidth: borderWidth.hairline,
    justifyContent: 'center',
    minWidth: 88,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  countdownText: {
    color: colors.accent,
    fontFamily: fontFamily.bold,
    fontSize: 36,
  },
  prompt: {
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
    width: '46%',
  },
  option: {
    alignItems: 'center',
    borderColor: colors.ink,
    borderRadius: radius.cardLarge,
    borderWidth: borderWidth.hairline,
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

  // The tally: a column of rows, each a label, a bar, and its count.
  tally: {
    alignSelf: 'stretch',
    gap: 16,
  },
  tallyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  tallyLabelBlock: {
    width: '30%',
  },
  tallyEmpty: {
    opacity: opacity.unavailable,
  },
  tallyLabel: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
  },
  tallyLabelText: {
    // The pill's own radius, carried by the text rather than clipped by the
    // surface around it: `overflow: 'hidden'` on a view sets `masksToBounds`,
    // which clips that view's shadow along with its children.
    borderRadius: radius.pill,
    fontFamily: fontFamily.medium,
    fontSize: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    textAlign: 'center',
  },
  // The bar sits in a fixed track and grows by `flexGrow`, so a row's fill is
  // its share of the leader's without measuring the screen.
  tallyTrack: {
    flexDirection: 'row',
    flexGrow: 1,
    height: 28,
    backgroundColor: colors.canvas,
    borderColor: colors.ink,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
    overflow: 'hidden',
  },
  tallyFill: {
    height: '100%',
  },
  tallyCount: {
    color: colors.ink,
    fontFamily: fontFamily.bold,
    fontSize: 26,
    minWidth: 48,
    textAlign: 'right',
  },

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
    fontSize: 44,
    textAlign: 'center',
  },
});
