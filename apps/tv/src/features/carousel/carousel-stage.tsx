import type { GameModule } from '@huddle/domain';
import { type CarouselWindow } from '@huddle/game-registry';
import { colors, elevation, motionDuration } from '@huddle/ui';
import { GameKeyArt, gameArtSurfaceColor, Icon, Surface } from '@huddle/ui/native';
import { PageDots, PhoneBrowsingHelper } from '@huddle/ui/kit';
import { useLayoutEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { TvHeader, TvStage } from '../../ui/native';
import type { RosterSeat } from '../../models';
import { cardEntryOffset } from './card-transition';
import { carouselFooterLine } from './carousel-footer';
import { styles } from './styles';

const absoluteFill = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;

export function CarouselStage({
  window,
  roster,
}: {
  readonly window: CarouselWindow;
  readonly roster: readonly RosterSeat[];
}) {
  const host = roster.find((seated) => seated.host);

  return (
    <TvStage>
      <View style={styles.screen}>
        <TvHeader />

        <CarouselCards window={window} />

        <View style={styles.carouselFooter}>
          <PageDots
            count={window.total}
            activeIndex={window.index}
            style={styles.pageDots}
            dotStyle={styles.pageDot}
            activeDotStyle={styles.pageDotActive}
          />
          {host === undefined ? (
            <Text style={styles.browsingLine}>{carouselFooterLine(host)}</Text>
          ) : (
            <PhoneBrowsingHelper name={host.nickname} />
          )}
        </View>
      </View>
    </TvStage>
  );
}

/**
 * The three cards, and the Card Transition between them (the handoff's
 * "TV animates card transition ~250ms ease-out").
 *
 * The row slides in from the direction the room browsed: the cards themselves
 * are swapped by the render that follows Convex's push, so what travels is the
 * row arriving where the new focused card belongs, not each card moving to its
 * own new place. `cardEntryOffset` decides the sign;
 * `motionDuration.cardTransition` and the ease-out are the handoff's.
 *
 * A slide and nothing else — no fade, no scale. The handoff pins the duration
 * and the easing and leaves the rest, and a translation is the one thing on this
 * screen that cannot cost a measurement: it is not laid out, so no card, dot or
 * shadow moves anywhere Yoga can see it, and the footer's 10pt of daylight under
 * the focused card's shadow is exactly where the last task left it.
 */
function CarouselCards({ window }: { readonly window: CarouselWindow }) {
  const entry = useCardTransition(window.index);

  return (
    <Animated.View style={[styles.carousel, entry]}>
      {/* The side cards are absent rather than duplicated with one game
          installed — `carouselWindow` is what decides that, and this just
          draws what it was handed. */}
      <Surface
        elevation={elevation.tvCard}
        style={[styles.carouselArrow, window.previous === undefined && styles.carouselArrowHidden]}
      >
        <Icon name="chevron-left" size={28} color={colors.ink} />
      </Surface>
      <SideKeyArt game={window.previous} />
      <FocusedGameCard game={window.focused} />
      <SideKeyArt game={window.next} />
      <Surface
        elevation={elevation.tvCard}
        style={[styles.carouselArrow, window.next === undefined && styles.carouselArrowHidden]}
      >
        <Icon name="chevron-right" size={28} color={colors.ink} />
      </Surface>
    </Animated.View>
  );
}

/**
 * The focused card: key art over the title and its chips at the approved
 * 440×520 geometry.
 */
function FocusedGameCard({ game }: { readonly game: GameModule }) {
  const { title, keyArt, playerRange, estimatedMinutes, category } = game.metadata;
  const artSurface = gameArtSurfaceColor(game.metadata.id, keyArt.color);

  return (
    <Surface
      elevation={elevation.tvHero}
      style={[styles.focusedCard, { backgroundColor: artSurface }]}
    >
      <View style={[styles.keyArt, { backgroundColor: colors[keyArt.color] }]}>
        <GameKeyArt
          gameId={game.metadata.id}
          title={title}
          color={keyArt.color}
          style={absoluteFill}
        />
        {game.placeholder ? <PlaceholderBadge /> : null}
      </View>

      <View style={[styles.cardInfo, { backgroundColor: artSurface }]}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={styles.chips}>
          <Chip text={`${playerRange.min}–${playerRange.max} players`} />
          <Chip text={`~${estimatedMinutes} min`} />
          <Chip text={category} />
        </View>
      </View>
    </Surface>
  );
}

/** A neighbouring card: key art alone, dimmed, tilted, and stood back. */
function SideKeyArt({ game }: { readonly game: GameModule | undefined }) {
  if (game === undefined) {
    // Nothing rather than a placeholder: an empty slot beside the focused card
    // would read as a game that failed to draw.
    return null;
  }

  const artSurface = gameArtSurfaceColor(game.metadata.id, game.metadata.keyArt.color);

  return (
    <View style={styles.sideCardWrapper}>
      <View
        style={[styles.sideCard, { backgroundColor: artSurface }]}
      >
        <View style={styles.sideArt}>
          <GameKeyArt
            gameId={game.metadata.id}
            title={game.metadata.title}
            color={game.metadata.keyArt.color}
            style={absoluteFill}
          />
          {game.placeholder ? <PlaceholderBadge /> : null}
        </View>
        <View
          style={[
            styles.sideCardInfo,
            { backgroundColor: artSurface },
          ]}
        >
          <Text style={styles.sideCardTitle}>{game.metadata.title}</Text>
        </View>
      </View>
    </View>
  );
}

function PlaceholderBadge() {
  return (
    <View style={styles.placeholderBadge}>
      <Text style={styles.placeholderBadgeText}>COMING SOON</Text>
    </View>
  );
}

/** One meta chip under a card's title. */
function Chip({ text }: { readonly text: string }) {
  return (
    <View style={styles.chip}>
      <View style={[absoluteFill, styles.chipWash]} />
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

/**
 * Carries carousel movement between renders without coupling layout to the
 * transition. A changed index starts the next row at the directional entry
 * offset and animates it into place.
 */
function useCardTransition(index: number) {
  const slide = useSharedValue(0);
  const [entry, setEntry] = useState(() => ({ index, offset: 0 }));

  if (entry.index !== index) {
    setEntry({ index, offset: cardEntryOffset(entry.index, index) });
  }

  useLayoutEffect(() => {
    if (entry.offset === 0) {
      return undefined;
    }

    slide.value = entry.offset;

    // Ease-out as the handoff writes it, at the duration Soft Minimal holds for
    // this animation: fast off the mark and settling into the new card, which
    // is the shape of a carousel that has been *pushed* somewhere rather than
    // one drifting there. Cubic is CSS's own `ease-out` curve.
    slide.value = withTiming(0, {
      duration: motionDuration.cardTransition,
      easing: Easing.out(Easing.cubic),
    });

    // A Host holding the arrow moves the index again mid-slide; the next
    // transition resets the driver from wherever this one had reached, and a
    // stopped animation is what keeps the two from fighting over it.
    return () => cancelAnimation(slide);
  }, [entry, slide]);

  return useAnimatedStyle(() => ({ transform: [{ translateX: slide.value }] }));
}
