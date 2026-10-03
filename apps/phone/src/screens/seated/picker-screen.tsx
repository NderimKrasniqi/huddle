import type { AvatarId, GameModule } from '@huddle/domain';
import { playroomColors, playroomPhone, playroomRadii } from '@huddle/design-tokens';
import { CAROUSEL_REGISTRY, carouselWindow } from '@huddle/game-registry';
import { PlayroomAvatar, PlayroomButton, PlayroomHeading, PlayroomPill, PlayroomPressable, PlayroomText, PlayroomGameCover } from '@huddle/ui/native';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { pickerControlState } from '../seated-phone-model';
import type { BusyAction } from '../use-seated-room';
import type { RosterSeat } from '../../features/room';
import { PhoneCard, PhoneFrame, PhoneNotice, PhoneTopBar } from './phone-frame';
import { RoomFaces } from './room-faces';

export type PickerScreenProps = {
  readonly browsingAt: number;
  readonly youAreHost: boolean;
  readonly hostNickname?: string;
  readonly hostAvatar?: AvatarId;
  readonly you?: { readonly nickname: string; readonly avatarId: AvatarId };
  /** Shown to guests, who wait on the host's choice with the room. */
  readonly roster?: readonly RosterSeat[];
  readonly busy: BusyAction;
  readonly failure?: string;
  readonly onBrowse: (index: number) => void;
  readonly onChoose: (module: GameModule) => void;
  readonly onBackToRoom: () => void;
  readonly onLeave: () => void;
};

/**
 * Choosing a game. The host sees the game on the TV as a featured card and
 * the rest as a list; tapping one moves the TV. Guests watch the selection.
 */
export function PickerScreen({
  browsingAt,
  youAreHost,
  hostNickname,
  hostAvatar,
  you,
  roster = [],
  busy,
  failure,
  onBrowse,
  onChoose,
  onBackToRoom,
  onLeave,
}: PickerScreenProps) {
  const window = carouselWindow(browsingAt);
  const index = window?.index ?? 0;
  const focused = window?.focused;
  const controls = pickerControlState({ youAreHost, focusedPlaceholder: focused?.placeholder === true, busy: busy !== null });
  if (focused === undefined) return null;
  const soon = focused.placeholder === true;

  return (
    <PhoneFrame
      avatarId={you?.avatarId}
      testID="phone-game-picker"
      footer={youAreHost ? <PlayroomButton label={soon ? 'Coming soon' : `Set up ${focused.metadata.title}`}
        onPress={() => onChoose(focused)} busy={busy === 'select'} disabled={!controls.selectEnabled}
        accessibilityLabel={soon ? `${focused.metadata.title}, coming soon` : `Set up ${focused.metadata.title}`}
        testID={soon ? 'picker-coming-soon' : 'picker-select'} /> : <PlayroomButton label="Leave room" variant="link" onPress={onLeave} accessibilityLabel="Leave room" testID="picker-leave" />}
    >
      <PhoneTopBar
        back={youAreHost ? { label: 'Room', onPress: onBackToRoom, testID: 'picker-back-top' } : undefined}
        you={you}
      />
      <PlayroomHeading type={playroomPhone.type.heading}>{youAreHost ? 'Choose a game' : 'Game night'}</PlayroomHeading>
      {!youAreHost ? (
        <PhoneCard style={styles.hostCard}>
          {hostAvatar ? <PlayroomAvatar avatarId={hostAvatar} size={52} host /> : null}
          <View style={styles.flex}>
            <PlayroomText style={playroomPhone.type.title}>{`${hostNickname ?? 'The host'} is choosing`}</PlayroomText>
            <PlayroomText color="muted" style={playroomPhone.type.body}>The TV follows along</PlayroomText>
          </View>
        </PhoneCard>
      ) : null}
      {youAreHost ? (
        <GameShelf index={index} busy={busy !== null} onBrowse={onBrowse} />
      ) : (
        <PlayroomPressable
          onPress={() => onBrowse(index)}
          disabled={controls.cardAction === null}
          accessibilityRole={youAreHost ? 'button' : 'image'}
          accessibilityLabel={`${focused.metadata.title}${soon ? ', coming soon' : ''}`}
          testID={`phone-game-card-${focused.metadata.id}`}
        >
          <PhoneCard style={styles.featured}>
            {/* Guests also see the room below, so their cover is a little smaller. */}
            <PlayroomGameCover gameId={focused.metadata.id} height={youAreHost ? 180 : 140} style={styles.cover} />
            <PlayroomText color={soon ? 'muted' : 'ink'} style={playroomPhone.type.hero}>
              {focused.metadata.title}
            </PlayroomText>
            <PlayroomText color="muted" style={[playroomPhone.type.body, styles.center]}>
              {focused.metadata.tagline ?? focused.metadata.category}
            </PlayroomText>
            {soon ? (
              <PlayroomPill tone="disabled" textStyle={playroomPhone.type.caption}>Coming soon</PlayroomPill>
            ) : null}
          </PhoneCard>
        </PlayroomPressable>
      )}
      {failure ? <PhoneNotice testID="picker-error">{failure}</PhoneNotice> : null}
      {youAreHost ? null : <RoomFaces roster={roster} />}
    </PhoneFrame>
  );
}

const SHELF_CARD = 300;
const SHELF_GAP = 14;

/**
 * The host's games as a shelf: one cover card per game, swiped like the TV
 * carousel. Settling on a card moves the TV there, and the footer button sets
 * up whichever game is in the middle.
 */
function GameShelf({ index, busy, onBrowse }: { readonly index: number; readonly busy: boolean; readonly onBrowse: (index: number) => void }) {
  const { width } = useWindowDimensions();
  const inset = Math.max((width - SHELF_CARD) / 2, 16);
  const ref = useRef<ScrollView>(null);
  useEffect(() => {
    ref.current?.scrollTo({ x: index * (SHELF_CARD + SHELF_GAP), animated: true });
  }, [index]);
  return (
    <>
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={SHELF_CARD + SHELF_GAP}
      decelerationRate="fast"
      contentContainerStyle={{ paddingHorizontal: inset, gap: SHELF_GAP }}
      style={styles.shelf}
      onMomentumScrollEnd={(event) => {
        const next = Math.round(event.nativeEvent.contentOffset.x / (SHELF_CARD + SHELF_GAP));
        if (next !== index && !busy) onBrowse(Math.min(Math.max(next, 0), CAROUSEL_REGISTRY.length - 1));
      }}
      testID="phone-game-shelf"
    >
      {CAROUSEL_REGISTRY.map((module, position) => {
        const soon = module.placeholder === true;
        const focused = position === index;
        return (
          <PlayroomPressable
            key={module.metadata.id}
            onPress={() => onBrowse(position)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`${module.metadata.title}${soon ? ', coming soon' : ''}${focused ? ', selected' : ''}`}
            accessibilityState={{ selected: focused }}
            testID={`phone-game-card-${module.metadata.id}`}
          >
            <PhoneCard style={[styles.shelfCard, focused ? styles.featured : null, soon ? styles.shelfSoon : null]}>
              <PlayroomGameCover gameId={module.metadata.id} height={200} style={styles.cover} />
              <PlayroomText color={soon ? 'muted' : 'ink'} style={playroomPhone.type.title}>{module.metadata.title}</PlayroomText>
              <PlayroomText color="muted" numberOfLines={2} style={[playroomPhone.type.caption, styles.center]}>
                {module.metadata.tagline ?? module.metadata.category}
              </PlayroomText>
              {soon ? <PlayroomPill tone="disabled" textStyle={playroomPhone.type.caption}>Coming soon</PlayroomPill> : null}
            </PhoneCard>
          </PlayroomPressable>
        );
      })}
    </ScrollView>
    <View style={styles.dots} accessibilityElementsHidden>
      {CAROUSEL_REGISTRY.map((module, position) => (
        <View key={module.metadata.id} style={[styles.dot, position === index ? styles.dotOn : null]} />
      ))}
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  shelf: { marginHorizontal: -20, flexGrow: 0 },
  shelfCard: { width: SHELF_CARD, alignItems: 'center', gap: 6, minHeight: 320 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: playroomColors.border },
  dotOn: { width: 22, backgroundColor: playroomColors.ink },
  shelfSoon: { opacity: 0.6 },
  cover: { width: '100%' },
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  // The game the host is on is the selection, so it is lavender whatever the game.
  featured: {
    backgroundColor: playroomColors.lavender,
    alignItems: 'center',
    gap: 4,
    paddingTop: 12,
    paddingBottom: 18,
  },
  featuredArt: {
    width: '80%',
    aspectRatio: 1.6,
  },
  featuredAction: {
    alignSelf: 'stretch',
    marginTop: 10,
  },
  list: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: playroomPhone.minTarget + 16,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 20,
  },
  rowPressed: {
    backgroundColor: playroomColors.lavender,
  },
  rowIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: playroomColors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowArt: {
    width: 64,
    height: 40,
  },
  rowTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowName: {
    ...playroomPhone.type.label,
    fontFamily: playroomPhone.type.title.fontFamily,
    flexShrink: 1,
  },
  rowPill: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: playroomRadii.pill,
  },
  chevron: {
    fontSize: 26,
    lineHeight: 28,
  },
});
