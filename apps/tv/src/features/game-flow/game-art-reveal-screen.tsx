import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ImageBackground,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { gameArtAsset } from './assets';
import { tvHostCopy } from './game-flow-model';

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;
export const TV_GAME_ART_REVEAL_DURATION_MS = 900;

export type TvSelectedGameArtScreenProps = {
  readonly gameId: string;
  readonly gameTitle?: string;
  readonly hostName?: string;
  readonly reduceMotion?: boolean;
  readonly onComplete?: () => void;
};

/** A short, local reveal between the authoritative selection and setup draft. */
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
        duration: TV_GAME_ART_REVEAL_DURATION_MS,
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
  const title = gameTitle?.trim() || (gameId === 'trivia' ? 'Trivia' : gameId === 'voting' ? 'Voting' : 'Game');
  const copy = tvHostCopy(hostName, 'is choosing settings on the phone.');

  return (
    <View style={styles.viewport} pointerEvents="none" testID="tv-selected-game-art">
      <Animated.View
        accessible
        focusable={false}
        accessibilityLabel={`${title} selected`}
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
          <View style={styles.fallbackArt} testID="tv-game-art-fallback" />
        )}
        {gameId === 'voting' ? <View style={styles.votingBadgeMask} testID="tv-voting-art-badge-mask" /> : null}
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{copy}</Text>
        </View>
      </Animated.View>
    </View>
  );
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
    backgroundColor: '#110A2F',
  },
  stage: {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    overflow: 'hidden',
  },
  fallbackArt: { ...StyleSheet.absoluteFill, backgroundColor: '#110A2F' },
  votingBadgeMask: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 126,
    backgroundColor: 'rgba(54,25,98,0.96)',
  },
  statusPill: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 44,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 999,
    backgroundColor: 'rgba(8,15,45,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  statusText: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', letterSpacing: 0.1 },
});
