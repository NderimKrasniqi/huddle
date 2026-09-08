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

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;
const OVERSCAN_X = 96;
const OVERSCAN_Y = 54;

export type TvReadyToStartScreenProps = {
  readonly gameId: string;
  readonly gameTitle?: string;
  readonly hostName?: string;
  readonly roomCode?: string;
  /** The coordinator should mount this only after mirroring the server start gate. */
  readonly ready?: boolean;
  readonly reduceMotion?: boolean;
};

/** Display-only confirmation after every current player has passed the start gate. */
export function TvReadyToStartScreen({
  gameId,
  gameTitle,
  hostName,
  roomCode,
  ready = true,
  reduceMotion = false,
}: TvReadyToStartScreenProps) {
  const viewport = useWindowDimensions();
  const scale = safeScale(viewport.width, viewport.height);
  const [enter] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  const animationRef = useRef<Animated.CompositeAnimation | undefined>(undefined);
  const title = gameTitle?.trim() || titleForGame(gameId);
  const host = hostName?.trim() || 'the host';
  const codeCopy = roomCode?.trim() ? `Room ${roomCode.trim().toUpperCase()}` : undefined;

  useEffect(() => {
    animationRef.current?.stop();
    if (reduceMotion) {
      enter.setValue(1);
      return;
    }
    enter.setValue(0);
    animationRef.current = Animated.timing(enter, {
      toValue: 1,
      duration: durationFor('slow', false),
      useNativeDriver: true,
    });
    animationRef.current.start();
    return () => animationRef.current?.stop();
  }, [enter, gameId, reduceMotion]);

  const art = gameArtAsset(gameId);

  return (
    <View
      style={styles.viewport}
      pointerEvents="none"
      focusable={false}
      accessible={false}
      testID="tv-game-ready"
    >
      <View
        style={[styles.stage, { transform: [{ scale }] }]}
        pointerEvents="none"
        focusable={false}
        accessible={false}
      >
        {art ? (
          <ImageBackground
            source={art}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
            accessible={false}
            testID={`tv-ready-art-${gameId}`}
          />
        ) : (
          <View style={styles.fallbackArt} pointerEvents="none" focusable={false} testID="tv-ready-art-fallback" />
        )}
        <View style={styles.artWash} pointerEvents="none" focusable={false} />
        <Animated.View
          accessible
          focusable={false}
          accessibilityRole="text"
          accessibilityLabel={ready ? `${title} ready to start` : `${title} waiting for players`}
          style={[
            styles.card,
            {
              opacity: enter,
              transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
            },
          ]}
        >
          <View style={styles.check} pointerEvents="none" focusable={false} testID="tv-game-ready-check">
            <HuddleText variant="hero" color="text" accessibilityElementsHidden>
              ✓
            </HuddleText>
          </View>
          <HuddleText variant="tvDisplay" color="surface" align="center" style={styles.title}>
            {ready ? 'Everyone is ready!' : 'Waiting for players'}
          </HuddleText>
          <HuddleText variant="bodyLarge" color="surface" align="center" style={styles.subtitle}>
            {ready ? `Waiting for ${host} to start ${title}.` : `Waiting for ${host} to finish setting up ${title}.`}
          </HuddleText>
          {codeCopy ? (
            <HuddleText variant="body" color="surface" align="center" style={styles.roomCode}>
              {codeCopy}
            </HuddleText>
          ) : null}
        </Animated.View>
        <HuddleText variant="caption" color="surface" style={styles.safeNote} accessibilityElementsHidden>
          Huddle TV
        </HuddleText>
      </View>
    </View>
  );
}

function titleForGame(gameId: string): string {
  if (gameId === 'trivia') return 'Trivia';
  if (gameId === 'voting') return 'Voting';
  return gameId.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
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
    opacity: 0.34,
  },
  card: {
    position: 'absolute',
    left: 530,
    top: 250,
    width: 860,
    minHeight: 420,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.xl,
    backgroundColor: semanticColors.text,
    borderColor: semanticColors.surface,
    borderWidth: 1,
    ...shadows.floating,
  },
  check: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.round,
    backgroundColor: semanticColors.success,
    borderColor: semanticColors.surface,
    borderWidth: 3,
  },
  title: {
    marginTop: spacing.xl,
    color: semanticColors.surface,
  },
  subtitle: {
    marginTop: spacing.sm,
    color: semanticColors.surface,
    opacity: 0.84,
  },
  roomCode: {
    marginTop: spacing.xl,
    color: semanticColors.surface,
    opacity: 0.82,
    letterSpacing: 2,
  },
  safeNote: {
    position: 'absolute',
    left: OVERSCAN_X,
    bottom: OVERSCAN_Y,
    color: semanticColors.surface,
    opacity: 0.7,
  },
});
