import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { TV_GAME_FLOW_ASSETS, gameCardAsset } from './assets';
import {
  DEFAULT_TV_CAROUSEL_CARDS,
  tvHostCopy,
  type TvGameCarouselCard,
} from './game-flow-model';

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;

export type TvGameCarouselScreenProps = {
  readonly hostName?: string;
  /** The authoritative carousel position, used when selectedGameId is absent. */
  readonly selectedIndex?: number;
  /** Stable registry id; preferred when the parent already resolved the window. */
  readonly selectedGameId?: string;
  /** A registry-derived window/list; defaults are only a visual fallback. */
  readonly cards?: readonly TvGameCarouselCard[];
  readonly reduceMotion?: boolean;
};

/** A display-only carousel. Phone controls and browse mutations stay outside this renderer. */
export function TvGameCarouselScreen({
  hostName,
  selectedIndex = 0,
  selectedGameId,
  cards = DEFAULT_TV_CAROUSEL_CARDS,
  reduceMotion = false,
}: TvGameCarouselScreenProps) {
  const viewport = useWindowDimensions();
  const scale = safeScale(viewport.width, viewport.height);
  const selectedId = selectedGameId ?? cards[selectedIndex]?.id;
  const spokenHost = hostName?.trim() || 'the host';

  return (
    <View style={styles.viewport} pointerEvents="none" testID="tv-game-carousel">
      <View style={[styles.stage, { transform: [{ scale }] }]} accessible focusable={false}>
        <ImageBackground
          source={TV_GAME_FLOW_ASSETS.background}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          accessible={false}
          testID="tv-game-flow-background"
        />
        <View style={styles.warmWash} />
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image
              source={TV_GAME_FLOW_ASSETS.mark}
              resizeMode="contain"
              style={styles.mark}
              accessible={false}
              testID="tv-game-flow-mark"
            />
            <Text style={styles.brandText}>Huddle</Text>
          </View>
          <Text
            style={styles.heading}
            accessibilityLabel={`${spokenHost} is choosing a game`}
            testID="tv-game-carousel-heading"
          >
            <Text style={styles.hostAccent}>{spokenHost}</Text> is choosing a game.
          </Text>
          <Text style={styles.subheading}>
            {tvHostCopy(hostName, 'is choosing on the phone.')}
          </Text>
        </View>

        <View style={styles.carousel} testID="tv-game-carousel-cards">
          {cards.map((card) => (
            <CarouselCard
              key={card.id}
              card={card}
              selected={selectedId === card.id}
              reduceMotion={reduceMotion}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function CarouselCard({
  card,
  selected,
  reduceMotion,
}: {
  readonly card: TvGameCarouselCard;
  readonly selected: boolean;
  readonly reduceMotion: boolean;
}) {
  const [selectedAnimation] = useState(() => new Animated.Value(selected ? 1 : 0));
  const animationRef = useRef<Animated.CompositeAnimation | undefined>(undefined);
  const image = card.image ?? gameCardAsset(card.id);

  useEffect(() => {
    animationRef.current?.stop();
    if (reduceMotion) {
      selectedAnimation.setValue(selected ? 1 : 0);
      return;
    }

    animationRef.current = Animated.spring(selectedAnimation, {
      toValue: selected ? 1 : 0,
      useNativeDriver: true,
      damping: 16,
      stiffness: 180,
      mass: 0.8,
    });
    animationRef.current.start();
    return () => animationRef.current?.stop();
  }, [reduceMotion, selected, selectedAnimation]);

  const transform = useMemo(
    () => [
      {
        scale: selectedAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.94, 1.055],
        }),
      },
      {
        translateY: selectedAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [10, -8],
        }),
      },
    ],
    [selectedAnimation],
  );

  return (
    <Animated.View
      accessible
      focusable={false}
      accessibilityLabel={`${card.title}${card.available === false ? ', coming soon' : ''}${selected ? ', selected' : ''}`}
      testID={`tv-game-card-${card.id}`}
      style={[
        styles.cardShell,
        {
          borderColor: selected ? '#FFFFFF' : 'rgba(255,255,255,0.42)',
          borderWidth: selected ? 5 : 2,
          opacity: card.available === false ? 0.82 : 1,
          transform,
        },
      ]}
    >
      {image ? (
        <Image source={image} resizeMode="contain" style={styles.cardImage} accessible={false} />
      ) : (
        <View style={styles.missingCard}>
          <Text style={styles.missingCardTitle}>{card.title}</Text>
        </View>
      )}
      {card.available === false ? (
        <View style={styles.comingSoonBadge} testID={`tv-game-card-coming-soon-${card.id}`}>
          <Text style={styles.comingSoonText}>Coming soon</Text>
        </View>
      ) : null}
    </Animated.View>
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
    backgroundColor: '#FFF3E5',
  },
  stage: {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    overflow: 'hidden',
  },
  warmWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,245,232,0.12)',
  },
  header: {
    position: 'absolute',
    top: 48,
    left: 72,
    right: 72,
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  mark: { width: 86, height: 86 },
  brandText: {
    color: '#001D49',
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: -1.2,
    marginLeft: 18,
  },
  heading: {
    color: '#001D49',
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 6,
  },
  hostAccent: { color: '#FF5B50' },
  subheading: {
    color: '#42506A',
    fontSize: 23,
    fontWeight: '500',
    marginTop: 8,
  },
  carousel: {
    position: 'absolute',
    left: 72,
    right: 72,
    top: 296,
    bottom: 44,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 22,
  },
  cardShell: {
    width: 330,
    height: 500,
    backgroundColor: 'rgba(255,255,255,0.30)',
    borderRadius: 42,
    overflow: 'hidden',
    shadowColor: '#6A4121',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 8,
  },
  cardImage: { width: '100%', height: '100%' },
  missingCard: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  missingCardTitle: { color: '#001D49', fontSize: 32, fontWeight: '900', textAlign: 'center' },
  comingSoonBadge: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,29,73,0.84)',
  },
  comingSoonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
