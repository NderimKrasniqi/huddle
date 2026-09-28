import { playroomColors, playroomEasing, playroomMotion, playroomTv } from '@huddle/design-tokens';
import { PlayroomHeading, PlayroomText, PlayroomTvStage, playroomGameArt } from '@huddle/ui/native';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe, ReduceMotion } from 'react-native-reanimated';

import { tvHostCopy } from './game-flow-model';
import { TvPlayroomFrame } from './playroom-frame';

export const TV_GAME_ART_REVEAL_DURATION_MS = 900;

/** The chosen game's art grows in from 0.8; never from nothing. */
const GROW = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.8 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.bezier(...playroomEasing.out) },
})
  .duration(playroomMotion.entrance)
  .reduceMotion(ReduceMotion.System);

export type TvSelectedGameArtScreenProps = {
  readonly gameId: string;
  readonly gameTitle?: string;
  readonly hostName?: string;
  readonly reduceMotion?: boolean;
  readonly onComplete?: () => void;
};

/** The beat between the host choosing a game and the setup draft appearing. */
export function TvSelectedGameArtScreen({
  gameId,
  gameTitle,
  hostName,
  reduceMotion = false,
  onComplete,
}: TvSelectedGameArtScreenProps) {
  const title = gameTitle?.trim() || titleForGame(gameId);
  const art = playroomGameArt(gameId);
  const copy = tvHostCopy(hostName, 'is choosing settings on the phone.');
  const completeRef = useRef(onComplete);

  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (reduceMotion) {
      completeRef.current?.();
      return;
    }
    const timer = setTimeout(() => completeRef.current?.(), TV_GAME_ART_REVEAL_DURATION_MS);
    return () => clearTimeout(timer);
  }, [gameId, reduceMotion]);

  return (
    <View
      style={styles.viewport}
      pointerEvents="none"
      focusable={false}
      accessible
      accessibilityLabel={`${title} selected. ${copy}`}
      testID="tv-selected-game-art"
    >
      <PlayroomTvStage>
        <TvPlayroomFrame reduceMotion={reduceMotion} />
        <View style={styles.column} pointerEvents="none" focusable={false}>
          {art ? (
            <Animated.Image
              entering={reduceMotion ? undefined : GROW}
              source={art}
              style={styles.art}
              resizeMode="contain"
              accessible={false}
              testID={`tv-game-art-${gameId}`}
            />
          ) : (
            <View style={styles.art} testID="tv-game-art-fallback" />
          )}
          <PlayroomHeading type={playroomTv.type.hero}>{`Let’s play ${title}!`}</PlayroomHeading>
          <PlayroomText color="muted" style={playroomTv.type.label} accessibilityElementsHidden>
            {copy}
          </PlayroomText>
        </View>
      </PlayroomTvStage>
    </View>
  );
}

function titleForGame(gameId: string): string {
  if (gameId === 'trivia') return 'Trivia';
  if (gameId === 'voting') return 'Voting';
  return 'Game';
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    backgroundColor: playroomColors.canvas,
  },
  column: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  art: {
    width: 880,
    height: 550,
  },
});
