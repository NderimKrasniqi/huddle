import { radii, semanticColors, shadows, spacing } from '@huddle/design-tokens';
import {
  HEARTBEAT_ARTWORK,
  HuddleText,
} from '@huddle/ui/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ImageBackground,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { gameCardAsset } from './assets';
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
  /** A registry-derived ordered list; only three positions are painted. */
  readonly cards?: readonly TvGameCarouselCard[];
  readonly reduceMotion?: boolean;
};

type CarouselSlot = {
  readonly card?: TvGameCarouselCard;
  readonly position: 'previous' | 'selected' | 'next';
};

/**
 * Display-only TV picker. The phone owns browsing; this stage mirrors the
 * authoritative index and paints exactly three cards: previous, focused and
 * next. The focused card is deliberately larger and lifted forward.
 */
export function TvGameCarouselScreen({
  hostName,
  selectedIndex = 0,
  selectedGameId,
  cards = DEFAULT_TV_CAROUSEL_CARDS,
  reduceMotion = false,
}: TvGameCarouselScreenProps) {
  const viewport = useWindowDimensions();
  const scale = safeScale(viewport.width, viewport.height);
  // The live registry always has five entries, but direct previews can pass
  // an empty list while data is resolving. Keep three real cards on screen.
  const catalog = cards.length > 0 ? cards : DEFAULT_TV_CAROUSEL_CARDS;
  const safeIndex = wrapIndex(
    selectedGameId === undefined
      ? selectedIndex
      : Math.max(catalog.findIndex((card) => card.id === selectedGameId), 0),
    catalog.length,
  );
  const spokenHost = hostName?.trim() || 'The host';
  const slots = useMemo<CarouselSlot[]>(
    () => [
      { card: catalog[wrapIndex(safeIndex - 1, catalog.length)], position: 'previous' },
      { card: catalog[safeIndex], position: 'selected' },
      { card: catalog[wrapIndex(safeIndex + 1, catalog.length)], position: 'next' },
    ],
    [catalog, safeIndex],
  );
  const selectedCard = catalog[safeIndex];

  return (
    <View
      style={styles.viewport}
      pointerEvents="none"
      focusable={false}
      accessible={false}
      testID="tv-game-carousel"
    >
      <View
        style={[styles.stage, { transform: [{ scale }] }]}
        pointerEvents="none"
        focusable={false}
        accessible={false}
      >
        <ImageBackground
          source={HEARTBEAT_ARTWORK.tv.platformLivingRoom}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          accessible={false}
          testID="tv-game-flow-background"
        />
        <View style={styles.atmosphereShade} pointerEvents="none" focusable={false} />
        <View style={styles.screenFrame} pointerEvents="none" focusable={false}>
          <View style={styles.screenInner} pointerEvents="none" focusable={false}>
            <View style={styles.header} pointerEvents="none" focusable={false} accessible={false}>
              <HuddleText variant="tvDisplay" color="surface" align="center" style={styles.heading}>
                What shall we play?
              </HuddleText>
              <HuddleText
                variant="bodyLarge"
                color="surface"
                align="center"
                style={styles.subheading}
                accessibilityLabel={`${spokenHost} is choosing a game`}
              >
                {tvHostCopy(hostName, 'is choosing a game.')}
              </HuddleText>
            </View>

            <View
              style={styles.carousel}
              pointerEvents="none"
              focusable={false}
              accessible={false}
              testID="tv-game-carousel-cards"
            >
              {slots.map((slot) => (
                <CarouselCard
                  key={`${slot.position}-${slot.card?.id ?? 'empty'}`}
                  card={slot.card}
                  selected={slot.position === 'selected'}
                  reduceMotion={reduceMotion}
                  position={slot.position}
                />
              ))}
            </View>

            <View style={styles.footer} pointerEvents="none" focusable={false} accessible={false}>
              <HuddleText variant="body" color="surface" align="center" style={styles.selectedDescription}>
                {selectedCard ? descriptionFor(selectedCard.id) : 'Choose a game on your phone.'}
              </HuddleText>
              <HuddleText variant="caption" color="surface" align="center" style={styles.selectedMeta}>
                {selectedCard ? metadataFor(selectedCard.id) : '2 – 10 Players  •  All Ages'}
              </HuddleText>
              <View style={styles.dots} pointerEvents="none" focusable={false}>
                {catalog.map((card, index) => (
                  <View
                    key={card.id}
                    style={[styles.dot, index === safeIndex ? styles.activeDot : null]}
                    pointerEvents="none"
                    focusable={false}
                  />
                ))}
              </View>
              <HuddleText variant="caption" color="surface" align="center" style={styles.phoneHint}>
                Use the Host phone to choose a game
              </HuddleText>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function CarouselCard({
  card,
  selected,
  reduceMotion,
  position,
}: {
  readonly card?: TvGameCarouselCard;
  readonly selected: boolean;
  readonly reduceMotion: boolean;
  readonly position: CarouselSlot['position'];
}) {
  const [selectedAnimation] = useState(() => new Animated.Value(selected ? 1 : 0));
  const animationRef = useRef<Animated.CompositeAnimation | undefined>(undefined);

  useEffect(() => {
    animationRef.current?.stop();
    if (reduceMotion) {
      selectedAnimation.setValue(selected ? 1 : 0);
      return;
    }

    animationRef.current = Animated.spring(selectedAnimation, {
      toValue: selected ? 1 : 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
      mass: 0.82,
    });
    animationRef.current.start();
    return () => animationRef.current?.stop();
  }, [reduceMotion, selected, selectedAnimation]);

  const transform = useMemo(
    () => [
      {
        scale: selectedAnimation.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }),
      },
      {
        translateY: selectedAnimation.interpolate({ inputRange: [0, 1], outputRange: [14, -18] }),
      },
    ],
    [selectedAnimation],
  );

  // The catalog is guaranteed non-empty by the parent fallback. Keep the
  // guard for a malformed custom preview without introducing an empty slot.
  const resolvedCard = card ?? DEFAULT_TV_CAROUSEL_CARDS[0];
  if (resolvedCard === undefined) return null;

  const image = resolvedCard.image ?? gameCardAsset(resolvedCard.id) ?? HEARTBEAT_ARTWORK.gameCards.trivia;
  const cardTone = toneForCard(resolvedCard.id);
  const label = `${resolvedCard.title}${resolvedCard.available === false ? ', coming soon' : ''}${selected ? ', selected' : ''}`;

  return (
    <Animated.View
      pointerEvents="none"
      focusable={false}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.cardSlot, selected ? styles.selectedSlot : position === 'previous' ? styles.previousSlot : styles.nextSlot, { transform }]}
      testID={`tv-game-card-${resolvedCard.id}`}
    >
      <View style={[styles.card, { backgroundColor: cardTone }]} pointerEvents="none" focusable={false}>
        <View style={styles.cardTopLine} pointerEvents="none" focusable={false}>
          <HuddleText variant="title" color="text" style={styles.cardTitle} numberOfLines={2}>
            {resolvedCard.title}
          </HuddleText>
          {selected ? <View style={styles.selectedDot} pointerEvents="none" focusable={false} /> : null}
        </View>
        <View style={styles.cardArtworkFrame} pointerEvents="none" focusable={false}>
          <Image source={image} resizeMode="contain" style={styles.cardArtwork} accessible={false} />
        </View>
        {resolvedCard.available === false ? (
          <View style={styles.comingSoonBadge} pointerEvents="none" focusable={false}>
            <HuddleText variant="caption" color="text">Coming soon</HuddleText>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

function toneForCard(id: string): string {
  switch (id) {
    case 'voting':
      return semanticColors.highlight;
    case 'doodle-dash':
      return semanticColors.info;
    case 'quick-poll':
      return semanticColors.accent;
    case 'hot-take':
      return semanticColors.primary;
    default:
      return semanticColors.success;
  }
}

function descriptionFor(id: string): string {
  switch (id) {
    case 'trivia':
      return 'Test your knowledge with fun questions!';
    case 'voting':
      return 'Vote, discuss, see the room’s take.';
    case 'doodle-dash':
      return 'Sketch fast. Guess first.';
    case 'quick-poll':
      return 'Share a thought. See what wins.';
    case 'hot-take':
      return 'Bold takes. Friendly debate.';
    default:
      return 'Choose a game on your phone.';
  }
}

function metadataFor(id: string): string {
  switch (id) {
    case 'trivia':
      return '2 – 10 Players  •  15 – 30 min  •  All Ages';
    case 'voting':
      return '2 – 10 Players  •  10 – 20 min  •  All Ages';
    case 'doodle-dash':
      return '3 – 8 Players  •  10 – 20 min  •  All Ages';
    case 'quick-poll':
      return '2 – 10 Players  •  5 – 10 min  •  All Ages';
    case 'hot-take':
      return '3 – 10 Players  •  10 – 20 min  •  All Ages';
    default:
      return '2 – 10 Players  •  All Ages';
  }
}

function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  const normalized = Math.trunc(index) % length;
  return normalized < 0 ? normalized + length : normalized;
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
  atmosphereShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: semanticColors.text,
    opacity: 0.24,
  },
  screenFrame: {
    position: 'absolute',
    left: 122,
    right: 122,
    top: 68,
    bottom: 140,
    borderRadius: radii.xl,
    padding: 14,
    backgroundColor: semanticColors.text,
    borderWidth: 4,
    borderColor: 'rgba(249,241,230,0.30)',
    ...shadows.floating,
  },
  screenInner: {
    flex: 1,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(43,31,23,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(249,241,230,0.35)',
    overflow: 'hidden',
  },
  header: {
    position: 'absolute',
    top: 48,
    left: 380,
    right: 380,
    alignItems: 'center',
  },
  heading: {
    color: semanticColors.surface,
    fontSize: 54,
    lineHeight: 64,
  },
  subheading: {
    marginTop: spacing.xs,
    color: semanticColors.surface,
    opacity: 0.72,
  },
  carousel: {
    position: 'absolute',
    left: 212,
    right: 212,
    top: 184,
    height: 500,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 32,
  },
  cardSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  edgeSlot: {
    width: 300,
    height: 500,
    opacity: 0.84,
  },
  previousSlot: {
    width: 300,
    height: 420,
    opacity: 0.84,
  },
  nextSlot: {
    width: 300,
    height: 420,
    opacity: 0.84,
  },
  selectedSlot: {
    width: 428,
    height: 500,
    zIndex: 3,
  },
  card: {
    width: '100%',
    height: '100%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 3,
    borderColor: 'rgba(43,31,23,0.18)',
    justifyContent: 'space-between',
    ...shadows.raised,
  },
  cardTopLine: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: semanticColors.text,
    fontSize: 30,
    lineHeight: 34,
    maxWidth: 280,
  },
  selectedDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: semanticColors.surface,
    borderWidth: 6,
    borderColor: semanticColors.success,
  },
  cardArtworkFrame: {
    flex: 1,
    minHeight: 0,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardArtwork: {
    width: '100%',
    height: '100%',
  },
  comingSoonBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(200,182,255,0.42)',
  },
  footer: {
    position: 'absolute',
    left: 240,
    right: 240,
    bottom: 34,
    alignItems: 'center',
  },
  selectedDescription: {
    color: semanticColors.surface,
    opacity: 0.94,
  },
  selectedMeta: {
    marginTop: spacing.xs,
    color: semanticColors.secondary,
    opacity: 0.94,
  },
  dots: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(249,241,230,0.38)',
    opacity: 0.58,
  },
  activeDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: semanticColors.secondary,
    opacity: 1,
  },
  phoneHint: {
    marginTop: spacing.sm,
    color: semanticColors.surface,
    opacity: 0.58,
  },
});
