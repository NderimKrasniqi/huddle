import { durationFor, radii, semanticColors, shadows, spacing } from '@huddle/design-tokens';
import { HuddleText } from '@huddle/ui/native';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ImageBackground,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { gameArtAsset } from './assets';
import { tvHostCopy } from './game-flow-model';

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;
const OVERSCAN_X = 96;
const OVERSCAN_Y = 54;
export const TV_GAME_ART_REVEAL_DURATION_MS = 900;

export type TvSelectedGameArtScreenProps = {
  readonly gameId: string;
  readonly gameTitle?: string;
  readonly hostName?: string;
  readonly reduceMotion?: boolean;
  readonly onComplete?: () => void;
};

/** The Heartbeat art reveal between authoritative selection and setup draft. */
export function TvSelectedGameArtScreen({
  gameId,
  gameTitle,
  hostName,
  reduceMotion = false,
  onComplete,
}: TvSelectedGameArtScreenProps) {
  const viewport = useWindowDimensions();
  const scale = safeScale(viewport.width, viewport.height);
  const [opacity] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  const [zoom] = useState(() => new Animated.Value(reduceMotion ? 1 : 1.035));
  const completeRef = useRef(onComplete);
  const animationRef = useRef<Animated.CompositeAnimation | undefined>(undefined);

  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    animationRef.current?.stop();
    if (reduceMotion) {
      opacity.setValue(1);
      zoom.setValue(1);
      completeRef.current?.();
      return;
    }

    opacity.setValue(0);
    zoom.setValue(1.035);
    animationRef.current = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: durationFor('celebration', false) + 200,
        useNativeDriver: true,
      }),
      Animated.spring(zoom, {
        toValue: 1,
        damping: 17,
        stiffness: 145,
        mass: 0.82,
        useNativeDriver: true,
      }),
    ]);
    animationRef.current.start(({ finished }) => {
      if (finished) completeRef.current?.();
    });

    return () => animationRef.current?.stop();
  }, [gameId, opacity, reduceMotion, zoom]);

  const art = gameArtAsset(gameId);
  const title = gameTitle?.trim() || titleForGame(gameId);
  const copy = tvHostCopy(hostName, 'is choosing settings on the phone.');

  return (
    <View
      style={styles.viewport}
      pointerEvents="none"
      focusable={false}
      accessible={false}
      testID="tv-selected-game-art"
    >
      <Animated.View
        accessible
        focusable={false}
        accessibilityRole="text"
        accessibilityLabel={`${title} selected. ${copy}`}
        style={[styles.stage, { opacity, transform: [{ scale }, { scale: zoom }] }]}
      >
        {art ? (
          <ImageBackground
            source={art}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
            accessible={false}
            testID={`tv-game-art-${gameId}`}
          />
        ) : (
          <View style={styles.fallbackArt} pointerEvents="none" focusable={false} testID="tv-game-art-fallback" />
        )}
        <View style={styles.artWash} pointerEvents="none" focusable={false} />
        {gameId === 'voting' ? (
          <View style={styles.badgeMask} pointerEvents="none" focusable={false} testID="tv-voting-art-badge-mask" />
        ) : null}
        <View style={styles.statusPill} pointerEvents="none" focusable={false}>
          <HuddleText variant="body" color="surface" align="center">
            {copy}
          </HuddleText>
        </View>
        <HuddleText variant="caption" color="surface" style={styles.safeNote} accessibilityElementsHidden>
          {title}
        </HuddleText>
      </Animated.View>
    </View>
  );
}

function titleForGame(gameId: string): string {
  switch (gameId) {
    case 'trivia':
      return 'Trivia';
    case 'voting':
      return 'Voting';
    default:
      return gameId.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}

function safeScale(width: number, height: number): number {
  const scale = Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: semanticColors.text,
  },
  stage: {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    overflow: 'hidden',
  },
  fallbackArt: {
    ...StyleSheet.absoluteFill,
    backgroundColor: semanticColors.text,
  },
  artWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: semanticColors.text,
    opacity: 0.28,
  },
  badgeMask: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 76,
    backgroundColor: semanticColors.text,
    opacity: 0.18,
  },
  statusPill: {
    position: 'absolute',
    left: OVERSCAN_X,
    right: OVERSCAN_X,
    bottom: 112,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: semanticColors.text,
    borderWidth: 1,
    borderColor: semanticColors.surface,
    opacity: 0.92,
    ...shadows.card,
  },
  safeNote: {
    position: 'absolute',
    left: OVERSCAN_X,
    top: OVERSCAN_Y,
    color: semanticColors.surface,
    opacity: 0.78,
  },
});
