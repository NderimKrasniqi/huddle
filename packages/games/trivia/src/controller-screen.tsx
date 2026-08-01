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
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { answerScreen, type AnswerOption } from './answering';
import { revealBeat, type TriviaEvent, type TriviaState } from './logic';

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
 * The four options, drawn as Boardwalk buttons.
 *
 * The color is `accentFace(optionIndex)` — the same cycle, off the same
 * position, that the television will draw the option in. That is what makes the
 * two match: not a number copied between two files, but one function neither
 * screen can disagree with.
 *
 * The buttons are not tilted. Boardwalk tilts cards and badges
 * (docs/design/design-handoff.md §"Signature style rules"); its buttons sit
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
    <StickerSurface
      depth={shadowDepth.phoneCard}
      style={[styles.answer, { backgroundColor: face.fill }]}
      // Dimmed rather than hidden or greyed, which is how Boardwalk says
      // "present, but not yours to take" everywhere else — the claimed color
      // swatches on "You're in" are the same 30%.
      wrapperStyle={[styles.answerBlock, option.state === 'closed' && styles.answerClosed]}
    >
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
    </StickerSurface>
  );
}

/** The pill that tells a player their answer is in and the waiting has started. */
function LockedInPill() {
  return (
    <StickerSurface depth={shadowDepth.phoneSmall} style={styles.lockedIn}>
      <Text style={styles.lockedInText}>LOCKED IN</Text>
    </StickerSurface>
  );
}

/**
 * Runs the beat that ends a Reveal.
 *
 * *What* to send and *when* is `revealBeat`, in the rules, where it can be
 * asserted — a mis-addressed advance is inert by design and would hang the
 * reveal in silence. This hook is only the timer around it.
 *
 * It comes from the phones because it cannot come from the television: a TV
 * screen is given the room's state and its roster and nothing else — it holds
 * no player record, and every game event has to name a player
 * (`TvGameScreenProps`, `GameEvent`). So the room's clock lives on the only
 * devices that can speak.
 *
 * *Every* playing phone runs it, not the Host's alone, and that is the point:
 * ten phones send the same `advance` a few milliseconds apart, the first moves
 * the room, and the rest are inert because the event is addressed to the beat
 * it ends. One nominated phone would be one phone whose screen locking stalls
 * the room; a crowd of redundant senders cannot. The hub skips the write for
 * the ones that change nothing, so the nine no-ops wake no subscription.
 */
function useRevealBeat(
  state: TriviaState,
  playerId: string,
  sendEvent: (event: TriviaEvent) => void,
) {
  const beat = revealBeat(state, playerId);

  // Both the beat and the hub's callback are fresh objects on every render —
  // `revealBeat` builds one, and nothing in `ControllerGameScreenProps`
  // promises `sendEvent` is stable. Depending on either directly would restart
  // the five seconds on each render, which is a reveal that never ends. The ref
  // is what the timer reads when it fires, so it always sends the current beat
  // through the current callback.
  const latest = useRef({ beat, sendEvent });

  useEffect(() => {
    latest.current = { beat, sendEvent };
  });

  // What the beat *is*, rather than which object it is: this changes only when
  // the room moves to another beat, which is exactly when the timer should
  // start over. It is the rules' own name for the beat (`GameDeadline`), the
  // same one the server winds its clock by, so the two cannot disagree about
  // when a beat has changed.
  const beatKey = beat?.beat ?? null;
  const afterMs = beat?.afterMs;

  useEffect(() => {
    if (beatKey === null || afterMs === undefined) {
      return;
    }

    const timer = setTimeout(() => {
      const current = latest.current;

      if (current.beat !== undefined) {
        current.sendEvent(current.beat.event);
      }
    }, afterMs);

    return () => clearTimeout(timer);
  }, [beatKey, afterMs]);
}

export function TriviaControllerScreen({
  state,
  player,
  sendEvent,
}: ControllerGameScreenProps<TriviaState, TriviaEvent>) {
  const screen = answerScreen(state, player.playerId);

  useRevealBeat(state, player.playerId, sendEvent);

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
    fontFamily: fontFamily.display,
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
    borderWidth: borderWidth.medium,
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
    fontFamily: fontFamily.bodyBold,
    fontSize: 20,
    textAlign: 'center',
  },
  lockedIn: {
    alignSelf: 'center',
    backgroundColor: colors.green,
    borderColor: colors.ink,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thin,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  lockedInText: {
    color: colors.ink,
    fontFamily: fontFamily.bodyBold,
    fontSize: 14,
    letterSpacing: letterSpacing.badge,
  },
  eyesUp: {
    color: colors.ink,
    fontFamily: fontFamily.body,
    fontSize: 18,
    textAlign: 'center',
  },
});
