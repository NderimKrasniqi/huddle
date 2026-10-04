import { COUNTDOWN_MS } from '@huddle/domain';
import { playroomColors, playroomEasing, playroomMotion, playroomTv } from '@huddle/design-tokens';
import { PlayroomAvatar, PlayroomHeading, PlayroomText, PlayroomTvStage } from '@huddle/ui/native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe, ReduceMotion } from 'react-native-reanimated';

import type { TvGameSetupScreenProps } from './game-setup-screen';
import { TvPlayroomFrame } from './playroom-frame';

/** Each number pops from 0.9; never from nothing. */
const TICK = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.9 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.bezier(...playroomEasing.out) },
})
  .duration(playroomMotion.transition)
  .reduceMotion(ReduceMotion.System);

const RING = 600;

/**
 * The countdown before a game starts. The server owns the deadline and
 * launches the game; this only shows the seconds left on the TV's clock.
 */
export function TvCountdownScreen({
  gameId,
  gameTitle,
  players = [],
  countdownEndsAt,
  reduceMotion = false,
}: TvGameSetupScreenProps & { readonly countdownEndsAt: number }) {
  const title = gameTitle?.trim() || (gameId === 'trivia' ? 'Trivia' : gameId === 'voting' ? 'Voting' : 'Game');
  const seconds = useSecondsLeft(countdownEndsAt);

  return (
    <View
      style={styles.viewport}
      pointerEvents="none"
      focusable={false}
      accessible
      accessibilityLabel={seconds > 0 ? `${title} starts in ${seconds}` : `${title} is starting`}
      testID="tv-game-countdown"
    >
      <PlayroomTvStage>
        <TvPlayroomFrame reduceMotion={reduceMotion} />
        <View style={styles.column} pointerEvents="none" focusable={false}>
          <PlayroomHeading type={playroomTv.type.heading}>{`${title} starts in`}</PlayroomHeading>
          <View style={styles.ring}>
            <Animated.View key={seconds} entering={reduceMotion ? undefined : TICK}>
              <PlayroomText style={seconds > 0 ? playroomTv.type.countdown : styles.go} accessibilityElementsHidden>
                {seconds > 0 ? String(seconds) : 'Go!'}
              </PlayroomText>
            </Animated.View>
          </View>
          <View style={styles.roster}>
            {players.map((player) =>
              player.avatarId ? (
                <PlayroomAvatar key={player.id} avatarId={player.avatarId} size={playroomTv.avatar.mini} away={player.away} />
              ) : null,
            )}
          </View>
          <PlayroomText color="muted" style={playroomTv.type.caption}>
            Anyone can stop the countdown from their phone.
          </PlayroomText>
        </View>
      </PlayroomTvStage>
    </View>
  );
}

/** Whole seconds until the deadline on this device's clock, 0 once it passes. */
function useSecondsLeft(endsAt: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [endsAt]);
  const left = Math.ceil((endsAt - now) / playroomMotion.tick);
  return Math.min(Math.max(left, 0), Math.ceil(COUNTDOWN_MS / playroomMotion.tick));
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    backgroundColor: playroomColors.canvas,
  },
  column: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    paddingTop: playroomTv.safeY - 10,
    gap: 22,
  },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 26,
    borderColor: playroomColors.orange,
    backgroundColor: playroomColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  go: {
    ...playroomTv.type.go,
    color: playroomColors.orange,
  },
  roster: {
    flexDirection: 'row',
    gap: 22,
    marginTop: 18,
  },
});
