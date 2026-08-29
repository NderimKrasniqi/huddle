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

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;

export type TvReadyToStartScreenProps = {
  readonly gameId: string;
  readonly gameTitle?: string;
  readonly hostName?: string;
  readonly roomCode?: string;
  /** The coordinator should mount this only after mirroring the server start gate. */
  readonly ready?: boolean;
  readonly reduceMotion?: boolean;
};

/** A display-only confirmation after every current player has passed the start gate. */
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

  useEffect(() => {
    animationRef.current?.stop();
    if (reduceMotion) {
      enter.setValue(1);
      return;
    }
    enter.setValue(0);
    animationRef.current = Animated.spring(enter, {
      toValue: 1,
      useNativeDriver: true,
      damping: 17,
      stiffness: 135,
      mass: 0.82,
    });
    animationRef.current.start();
    return () => animationRef.current?.stop();
  }, [enter, gameId, reduceMotion]);

  const art = gameArtAsset(gameId);
  const title = gameTitle?.trim() || titleForGame(gameId);
  const host = hostName?.trim() || 'the host';
  const codeCopy = roomCode?.trim() ? `Room ${roomCode.trim()}` : undefined;

  return (
    <View style={styles.viewport} pointerEvents="none" testID="tv-game-ready">
      <View style={[styles.stage, { transform: [{ scale }] }]} accessible focusable={false}>
        {art ? (
          <ImageBackground
            source={art}
            resizeMode="cover"
            blurRadius={4}
            style={StyleSheet.absoluteFill}
            accessible={false}
            testID={`tv-ready-art-${gameId}`}
          />
        ) : (
          <View style={styles.fallbackArt} testID="tv-ready-art-fallback" />
        )}
        {gameId === 'voting' ? <View style={styles.votingBadgeMask} testID="tv-ready-voting-art-badge-mask" /> : null}
        <View style={styles.scrim} />
        <Animated.View
          accessible
          focusable={false}
          accessibilityLabel={ready ? `${title} ready to start` : `${title} waiting for players`}
          style={[
            styles.card,
            {
              opacity: enter,
              transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
            },
          ]}
        >
          <View style={styles.check} testID="tv-game-ready-check">
            <Text style={styles.checkText}>✓</Text>
          </View>
          <Text style={styles.title}>{ready ? 'Everyone is ready!' : 'Waiting for players'}</Text>
          <Text style={styles.subtitle}>
            {ready ? `Waiting for ${host} to start ${title}.` : `Waiting for ${host} to finish setting up ${title}.`}
          </Text>
          {codeCopy ? <Text style={styles.roomCode}>{codeCopy}</Text> : null}
        </Animated.View>
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
    backgroundColor: '#110A2F',
  },
  stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT, overflow: 'hidden' },
  fallbackArt: { ...StyleSheet.absoluteFill, backgroundColor: '#110A2F' },
  votingBadgeMask: {
    ...StyleSheet.absoluteFill,
    top: 954,
    backgroundColor: 'rgba(54,25,98,0.96)',
  },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8,15,45,0.48)' },
  card: {
    position: 'absolute',
    alignSelf: 'center',
    top: 270,
    width: 780,
    paddingHorizontal: 60,
    paddingVertical: 48,
    alignItems: 'center',
    borderRadius: 38,
    backgroundColor: 'rgba(19,12,57,0.92)',
    borderColor: 'rgba(255,255,255,0.24)',
    borderWidth: 1,
  },
  check: {
    width: 86,
    height: 86,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderColor: '#5ED583',
    borderWidth: 5,
    backgroundColor: 'rgba(94,213,131,0.15)',
  },
  checkText: { color: '#5ED583', fontSize: 50, fontWeight: '900', marginTop: -3 },
  title: { color: '#FFF9F4', fontSize: 48, fontWeight: '900', marginTop: 24, textAlign: 'center' },
  subtitle: { color: '#DDD4F6', fontSize: 24, fontWeight: '600', marginTop: 12, textAlign: 'center' },
  roomCode: { color: 'rgba(255,249,244,0.72)', fontSize: 18, fontWeight: '800', letterSpacing: 1.4, marginTop: 22 },
});
