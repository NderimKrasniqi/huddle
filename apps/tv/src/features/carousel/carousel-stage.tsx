import type { GameModule } from '@huddle/game-core';
import { type CarouselWindow } from '@huddle/game-registry';
import { colors, elevation, motionDuration } from '@huddle/ui';
import { GameKeyArt, Surface, Wordmark } from '@huddle/ui/native';
import { useLayoutEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { TvStage } from '../../ui';
import { roomLayout, type RosterSeat } from '../room';
import { cardEntryOffset } from './card-transition';
import { carouselFooterLine } from './carousel-footer';
import { styles } from './styles';

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
        <View style={styles.header}>
          <Wordmark height={roomLayout.wordmark} />
        </View>

        <CarouselCards window={window} />

        <View style={styles.carouselFooter}>
          <View style={styles.pageDots}>
            {Array.from({ length: window.total }, (_unused, position) => (
              <View
                key={position}
                style={[styles.pageDot, position === window.index && styles.pageDotActive]}
              />
            ))}
          </View>
          <Text style={styles.browsingLine}>{carouselFooterLine(host)}</Text>
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
      <SideKeyArt game={window.previous} />
      <FocusedGameCard game={window.focused} />
      <SideKeyArt game={window.next} />
    </Animated.View>
  );
}

/**
 * The focused card: key art over the title and its chips (handoff §6 — 440×520,
 * 4px ink border, 10px accent offset shadow).
 */
function FocusedGameCard({ game }: { readonly game: GameModule }) {
  const { title, keyArt, playerRange, estimatedMinutes, category } = game.metadata;

  return (
    <Surface
      elevation={elevation.tvHero}
      style={styles.focusedCard}
    >
      <View style={[styles.keyArt, { backgroundColor: colors[keyArt.color] }]}>
        <GameKeyArt
          gameId={game.metadata.id}
          title={title}
          color={keyArt.color}
          style={StyleSheet.absoluteFill}
        />
        {game.placeholder ? <PlaceholderBadge /> : null}
        <Text style={styles.keyArtTitle}>{title}</Text>
      </View>

      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={styles.chips}>
          <Chip text={`${playerRange.min}–${playerRange.max} players`} />
          <Chip text={`~${estimatedMinutes} min`} />
          <Chip text={category} tone={colors.soft} />
        </View>
      </View>
    </Surface>
  );
}

/** A neighbouring card: key art alone, dimmed, tilted and stood back (§6). */
function SideKeyArt({ game }: { readonly game: GameModule | undefined }) {
  if (game === undefined) {
    // Nothing rather than a placeholder: an empty slot beside the focused card
    // would read as a game that failed to draw.
    return null;
  }

  return (
    <View style={styles.sideCardWrapper}>
      <View
        style={[styles.sideCard, { backgroundColor: colors[game.metadata.keyArt.color] }]}
      >
        <GameKeyArt
          gameId={game.metadata.id}
          title={game.metadata.title}
          color={game.metadata.keyArt.color}
          style={StyleSheet.absoluteFill}
        />
        {game.placeholder ? <PlaceholderBadge /> : null}
        <Text style={styles.sideCardTitle}>{game.metadata.title}</Text>
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
function Chip({ text, tone }: { readonly text: string; readonly tone?: string }) {
  return (
    <View style={[styles.chip, tone === undefined ? null : { backgroundColor: tone }]}>
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

/**
 * Carries carousel movement between renders without coupling layout to the
 * transition. A changed index starts the next row at the directional entry
 * offset and animates it into place.
 */
function useCardTransition(
  index: number,
): { readonly transform: readonly [{ translateX: Animated.Value }] } {
  const [slide] = useState(() => new Animated.Value(0));
  const [entry, setEntry] = useState(() => ({ index, offset: 0 }));

  if (entry.index !== index) {
    setEntry({ index, offset: cardEntryOffset(entry.index, index) });
  }

  useLayoutEffect(() => {
    if (entry.offset === 0) {
      return undefined;
    }

    slide.setValue(entry.offset);

    // Ease-out as the handoff writes it, at the duration Soft Minimal holds for
    // this animation: fast off the mark and settling into the new card, which
    // is the shape of a carousel that has been *pushed* somewhere rather than
    // one drifting there. Cubic is CSS's own `ease-out` curve.
    const travel = Animated.timing(slide, {
      toValue: 0,
      duration: motionDuration.cardTransition,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    travel.start();

    // A Host holding the arrow moves the index again mid-slide; the next
    // transition resets the driver from wherever this one had reached, and a
    // stopped animation is what keeps the two from fighting over it.
    return () => travel.stop();
  }, [entry, slide]);

  return { transform: [{ translateX: slide }] };
}
