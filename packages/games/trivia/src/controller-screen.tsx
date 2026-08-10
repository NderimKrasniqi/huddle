import type { ControllerGameScreenProps } from '@huddle/game-core';
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
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { answerScreen, type AnswerOption } from './answering';
import type { TriviaEvent, TriviaState } from './logic';

/**
 * Trivia on the phone: four buttons, and then a phone that gets out of the way.
 *
 * Everything this draws comes from `answerScreen` — what to offer is decided
 * there, against the reducer's own rules, and this file only draws it. So the
 * question "could a tap arrive that the rules would refuse?" is answered where
 * it can be tested (`answering.test.ts`), not in a renderer the repo does not
 * test (docs/tech-stack.md).
 *
 * Three of the task's four promises are structural rather than defended here:
 * a locked-in player's buttons are not pressable because `answerScreen` marks
 * them so, a second tap changes nothing because the reducer refuses it *and*
 * the button is already disabled, and answering before a question is up is
 * impossible because on any other beat there is no button on the screen at all
 * — the phone is showing "eyes up" instead.
 */

/**
 * The four options, drawn as Soft Minimal buttons.
 *
 * The color is `accentFace(optionIndex)` — the same cycle, off the same
 * position, that the television will draw the option in. That is what makes the
 * two match: not a number copied between two files, but one function neither
 * screen can disagree with.
 *
 * The buttons are not tilted. Soft Minimal tilts cards and badges
 * (docs/design/soft-minimal-handoff.md §"Signature style rules"); its buttons sit
 * square, and four tilted blocks under a thumb would read as a pile rather than
 * a row of choices.
 */
function AnswerButton({
  option,
  lockedIn,
  onPress,
}: {
  readonly option: AnswerOption;
  readonly lockedIn: boolean;
  readonly onPress: () => void;
}) {
  const face = accentFace(option.optionIndex);

  return (
    <Surface
      elevation={elevation.phoneCard}
      // Dimmed rather than hidden or greyed, which is how Soft Minimal says
      // "present, but not yours to take" without removing the choice.
      style={[[styles.answerBlock, option.state === 'closed' && styles.answerClosed], [styles.answer, { backgroundColor: face.fill }]]}>
      <Pressable
        accessibilityRole="button"
        // The one place the screen refuses a tap, and it refuses it by not
        // being pressable rather than by ignoring a press: a button that
        // swallows taps silently is a button people keep pressing.
        disabled={lockedIn}
        onPress={onPress}
        style={styles.answerPress}
      >
        <Text style={[styles.answerText, { color: face.label }]}>{option.text}</Text>
      </Pressable>
    </Surface>
  );
}

/** The pill that tells a player their answer is in and the waiting has started. */
function LockedInPill() {
  return (
    <Surface elevation={elevation.phoneSmall} style={styles.lockedIn}>
      <Text style={styles.lockedInText}>LOCKED IN</Text>
    </Surface>
  );
}

export function TriviaControllerScreen({
  state,
  player,
  sendEvent,
}: ControllerGameScreenProps<TriviaState, TriviaEvent>) {
  const screen = answerScreen(state, player.playerId);

  if (screen.kind === 'eyesUp') {
    return (
      <View style={styles.stage}>
        <Text style={styles.eyesUp}>{screen.line}</Text>
      </View>
    );
  }

  return (
    <View style={styles.stage}>
      <Text style={styles.question}>{screen.text}</Text>

      {screen.options.map((option) => (
        <AnswerButton
          key={option.optionIndex}
          option={option}
          lockedIn={screen.lockedIn}
          onPress={() =>
            sendEvent({
              kind: 'answer',
              playerId: player.playerId,
              // The question this screen was drawn for, not whatever is up when
              // the tap lands — see `TriviaEvent`. A tap that was a beat too
              // late answers the question the thumb was aiming at, or nothing.
              questionIndex: screen.questionIndex,
              optionIndex: option.optionIndex,
            })
          }
        />
      ))}

      {screen.lockedIn ? <LockedInPill /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'stretch',
    alignSelf: 'stretch',
    gap: 12,
  },
  question: {
    color: colors.ink,
    fontFamily: fontFamily.bold,
    fontSize: 22,
    textAlign: 'center',
  },
  answerBlock: {
    alignSelf: 'stretch',
  },
  answerClosed: {
    opacity: opacity.unavailable,
  },
  answer: {
    borderColor: colors.ink,
    borderRadius: radius.button,
    borderWidth: borderWidth.hairline,
  },
  // The tap target is the whole block, so the padding lives on the pressable
  // rather than on the surface around it.
  answerPress: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  answerText: {
    fontFamily: fontFamily.semibold,
    fontSize: 20,
    textAlign: 'center',
  },
  lockedIn: {
    alignSelf: 'center',
    backgroundColor: colors.online,
    borderColor: colors.ink,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  lockedInText: {
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
