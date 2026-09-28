import { playroomColors, playroomEasing, playroomMotion, playroomRadii, playroomShadows, playroomTv } from '@huddle/design-tokens';
import { PlayroomHeading, PlayroomPill, PlayroomText, PlayroomTvStage, playroomGameArt } from '@huddle/ui/native';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe, ReduceMotion } from 'react-native-reanimated';

import { DEFAULT_TV_CAROUSEL_CARDS, tvHostCopy, type TvGameCarouselCard, type TvGamePlayer } from './game-flow-model';
import { TvPlayroomFrame, TvRosterRow } from './playroom-frame';

/** The card the host moves onto settles in; it never grows from nothing. */
const SELECT = new Keyframe({
  0: { opacity: 0.6, transform: [{ scale: 0.97 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.bezier(...playroomEasing.out) },
})
  .duration(playroomMotion.transition)
  .reduceMotion(ReduceMotion.System);

export type TvGameCarouselScreenProps = {
  readonly hostName?: string;
  /** The authoritative carousel position, used when selectedGameId is absent. */
  readonly selectedIndex?: number;
  /** Stable registry id; preferred when the parent already resolved the window. */
  readonly selectedGameId?: string;
  /** A registry-derived ordered list; three cards are painted at a time. */
  readonly cards?: readonly TvGameCarouselCard[];
  /** The room, shown along the bottom. */
  readonly players?: readonly TvGamePlayer[];
  readonly reduceMotion?: boolean;
};

/**
 * Display-only TV picker. The phone owns browsing; this stage mirrors the
 * authoritative index with three cards. The window stops at each end of the
 * catalogue rather than wrapping, and the card the host is on is lavender
 * with an ink border.
 */
export function TvGameCarouselScreen({
  hostName,
  selectedIndex = 0,
  selectedGameId,
  cards = DEFAULT_TV_CAROUSEL_CARDS,
  players = [],
  reduceMotion = false,
}: TvGameCarouselScreenProps) {
  // Direct previews can pass an empty list while data is resolving.
  const catalog = cards.length > 0 ? cards : DEFAULT_TV_CAROUSEL_CARDS;
  const index = clamp(
    selectedGameId === undefined ? selectedIndex : Math.max(catalog.findIndex((card) => card.id === selectedGameId), 0),
    0,
    catalog.length - 1,
  );
  const start = clamp(index - 1, 0, Math.max(catalog.length - 3, 0));
  const window = catalog.slice(start, start + 3);
  const spokenHost = hostName?.trim() || 'The host';

  return (
    <View style={styles.viewport} pointerEvents="none" focusable={false} accessible={false} testID="tv-game-carousel">
      <PlayroomTvStage testID="tv-game-flow-background">
        <TvPlayroomFrame reduceMotion={reduceMotion} />
        <View style={styles.column} pointerEvents="none" focusable={false}>
          <PlayroomHeading type={playroomTv.type.heading}>What are we playing?</PlayroomHeading>
          <PlayroomText
            color="muted"
            style={playroomTv.type.label}
            accessibilityLabel={`${spokenHost} is choosing a game`}
          >
            {tvHostCopy(hostName, 'is choosing a game.')}
          </PlayroomText>
          <View style={styles.cards} pointerEvents="none" focusable={false} testID="tv-game-carousel-cards">
            {window.map((card) => (
              <GameCard key={card.id} card={card} selected={card.id === catalog[index]?.id} reduceMotion={reduceMotion} />
            ))}
          </View>
          <TvRosterRow players={players} />
        </View>
      </PlayroomTvStage>
    </View>
  );
}

function GameCard({
  card,
  selected,
  reduceMotion,
}: {
  readonly card: TvGameCarouselCard;
  readonly selected: boolean;
  readonly reduceMotion: boolean;
}) {
  const available = card.available !== false;
  const art = playroomGameArt(card.id);
  return (
    <Animated.View
      // A new key when selection moves replays the settle on the new card only.
      key={selected ? 'selected' : 'side'}
      entering={selected && !reduceMotion ? SELECT : undefined}
      style={[styles.card, selected ? styles.selected : null, !available ? styles.soon : null]}
      pointerEvents="none"
      focusable={false}
      accessible
      accessibilityLabel={`${card.title}${available ? '' : ', coming soon'}${selected ? ', selected' : ''}`}
      testID={`tv-game-card-${card.id}`}
    >
      <View style={[styles.art, selected ? styles.artSelected : null]}>
        {art ? <Image source={art} style={styles.artImage} resizeMode="contain" accessible={false} /> : null}
      </View>
      <PlayroomText color={available ? 'ink' : 'muted'} numberOfLines={1} style={selected ? styles.titleSelected : styles.title}>
        {card.title}
      </PlayroomText>
      {card.subtitle !== undefined && available ? (
        <PlayroomText color="muted" numberOfLines={2} style={[playroomTv.type.caption, styles.subtitle]}>
          {card.subtitle}
        </PlayroomText>
      ) : null}
      <PlayroomPill tone="surface" textStyle={playroomTv.type.caption} style={styles.pill}>
        {available ? 'Available' : 'Coming soon'}
      </PlayroomPill>
    </Animated.View>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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
    gap: 16,
  },
  cards: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 42,
    marginTop: 8,
    marginBottom: 34,
  },
  card: {
    width: 460,
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 26,
    paddingTop: 22,
    paddingBottom: 26,
    borderRadius: playroomRadii.card,
    backgroundColor: playroomColors.surface,
    ...playroomShadows.card,
  },
  selected: {
    width: 614,
    backgroundColor: playroomColors.lavender,
    borderWidth: 6,
    borderColor: playroomColors.ink,
  },
  soon: {
    backgroundColor: playroomColors.disabled,
  },
  art: {
    width: '100%',
    height: 270,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artSelected: {
    height: 330,
  },
  artImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    ...playroomTv.type.title,
    textAlign: 'center',
  },
  titleSelected: {
    ...playroomTv.type.heading,
    fontSize: 70,
    lineHeight: 78,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
  pill: {
    marginTop: 8,
  },
});
