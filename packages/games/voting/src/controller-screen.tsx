import type { ControllerGameScreenProps } from '@huddle/game-core';
import {
  accentFace,
  borderWidth,
  colors,
  fontFamily,
  letterSpacing,
  opacity,
  radius,
  shadowDepth,
} from '@huddle/ui';
import { StickerSurface } from '@huddle/ui/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VotingEvent, VotingState } from './logic';
import { voteScreen, type VoteOption } from './voting-controller';

/**
 * Voting on the phone: the prompt's options, a tap, and then a phone that gets
 * out of the way.
 *
 * Everything this draws comes from `voteScreen`, against the reducer's own
 * rules; this file only draws it, so "could a tap arrive that the rules would
 * refuse?" is answered where it can be tested (`voting-controller.test.ts`),
 * not in a renderer the repo does not test (docs/tech-stack.md).
 *
 * There is no timer here, unlike trivia's Controller: both of this game's beats
 * end on the room's own clock (`voteTimer`, `revealTimer`), so a phone's whole
 * part in a game of Voting is the one vote it casts.
 */

/**
 * One option, drawn as a Boardwalk button in the accent the television draws it
 * in — `accentFace(optionIndex)`, the same cycle off the same position, so the
 * two match by one function rather than a number copied between files.
 *
 * Buttons sit square: Boardwalk tilts cards and badges, not buttons, and a row
 * of tilted blocks under a thumb would read as a pile rather than choices.
 */
function OptionButton({
  option,
  voted,
  onPress,
}: {
  readonly option: VoteOption;
  readonly voted: boolean;
  readonly onPress: () => void;
}) {
  const face = accentFace(option.optionIndex);

  return (
    <StickerSurface
      depth={shadowDepth.phoneCard}
      style={[styles.option, { backgroundColor: face.fill }]}
      // Dimmed once the ballot is in, which is how Boardwalk says "present, but
      // not yours to take" everywhere else.
      wrapperStyle={[styles.optionBlock, option.state === 'closed' && styles.optionClosed]}
    >
      <Pressable
        accessibilityRole="button"
        // Refused by not being pressable rather than by swallowing the tap: a
        // button that eats presses silently is a button people keep pressing.
        disabled={voted}
        onPress={onPress}
        style={styles.optionPress}
      >
        <Text style={[styles.optionText, { color: face.label }]}>{option.text}</Text>
      </Pressable>
    </StickerSurface>
  );
}

/** The pill that tells a player their ballot is in and the waiting has started. */
function VoteInPill() {
  return (
    <StickerSurface depth={shadowDepth.phoneSmall} style={styles.voteIn}>
      <Text style={styles.voteInText}>VOTE IN</Text>
    </StickerSurface>
  );
}

export function VotingControllerScreen({
  state,
  player,
  sendEvent,
}: ControllerGameScreenProps<VotingState, VotingEvent>) {
  const screen = voteScreen(state, player.playerId);

  if (screen.kind === 'eyesUp') {
    return (
      <View style={styles.stage}>
        <Text style={styles.eyesUp}>{screen.line}</Text>
      </View>
    );
  }

  return (
    <View style={styles.stage}>
      <Text style={styles.prompt}>{screen.text}</Text>

      {screen.options.map((option) => (
        <OptionButton
          key={option.optionIndex}
          option={option}
          voted={screen.voted}
          onPress={() =>
            sendEvent({
              kind: 'vote',
              playerId: player.playerId,
              // The prompt this screen was drawn for, not whatever is up when the
              // tap lands — see `VotingEvent`. A tap a beat too late votes on the
              // prompt the thumb was aiming at, or nothing.
              promptIndex: screen.promptIndex,
              optionIndex: option.optionIndex,
            })
          }
        />
      ))}

      {screen.voted ? <VoteInPill /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'stretch',
    alignSelf: 'stretch',
    gap: 12,
  },
  prompt: {
    color: colors.ink,
    fontFamily: fontFamily.bold,
    fontSize: 22,
    textAlign: 'center',
  },
  optionBlock: {
    alignSelf: 'stretch',
  },
  optionClosed: {
    opacity: opacity.unavailable,
  },
  option: {
    borderColor: colors.ink,
    borderRadius: radius.button,
    borderWidth: borderWidth.medium,
  },
  optionPress: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  optionText: {
    fontFamily: fontFamily.semibold,
    fontSize: 20,
    textAlign: 'center',
  },
  voteIn: {
    alignSelf: 'center',
    backgroundColor: colors.green,
    borderColor: colors.ink,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  voteInText: {
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: 14,
    letterSpacing: letterSpacing.badge,
  },
  eyesUp: {
    color: colors.ink,
    fontFamily: fontFamily.regular,
    fontSize: 18,
    textAlign: 'center',
  },
});
