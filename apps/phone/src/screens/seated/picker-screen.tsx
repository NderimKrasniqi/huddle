import type { AvatarId, GameModule } from '@huddle/domain';
import { playroomColors, playroomPhone, playroomRadii } from '@huddle/design-tokens';
import { CAROUSEL_REGISTRY, carouselWindow } from '@huddle/game-registry';
import { PlayroomAvatar, PlayroomButton, PlayroomHeading, PlayroomPill, PlayroomText, playroomGameArt } from '@huddle/ui/native';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { pickerControlState } from '../seated-phone-model';
import type { BusyAction } from '../use-seated-room';
import { PhoneCard, PhoneFrame, PhoneNotice, PhoneTopBar } from './phone-frame';

export type PickerScreenProps = {
  readonly browsingAt: number;
  readonly youAreHost: boolean;
  readonly hostNickname?: string;
  readonly hostAvatar?: AvatarId;
  readonly you?: { readonly nickname: string; readonly avatarId: AvatarId };
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
  const art = playroomGameArt(focused.metadata.id);

  return (
    <PhoneFrame
      avatarId={you?.avatarId}
      testID="phone-game-picker"
      footer={youAreHost ? undefined : <PlayroomButton label="Leave room" variant="link" onPress={onLeave} accessibilityLabel="Leave room" testID="picker-leave" />}
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
      <Pressable
        onPress={() => onBrowse(index)}
        disabled={controls.cardAction === null}
        accessibilityRole={youAreHost ? 'button' : 'image'}
        accessibilityLabel={`${focused.metadata.title}${soon ? ', coming soon' : ''}`}
        testID={`phone-game-card-${focused.metadata.id}`}
      >
        <PhoneCard style={[styles.featured, soon ? styles.soon : null]}>
          {art ? <Image source={art} style={styles.featuredArt} resizeMode="contain" accessible={false} /> : null}
          <PlayroomText color={soon ? 'muted' : 'ink'} style={playroomPhone.type.hero}>
            {focused.metadata.title}
          </PlayroomText>
          <PlayroomText color="muted" style={[playroomPhone.type.body, styles.center]}>
            {focused.metadata.tagline ?? focused.metadata.category}
          </PlayroomText>
          {youAreHost ? (
            <PlayroomButton
              label={soon ? 'Coming soon' : `Set up ${focused.metadata.title}`}
              onPress={() => onChoose(focused)}
              busy={busy === 'select'}
              disabled={!controls.selectEnabled}
              accessibilityLabel={soon ? `${focused.metadata.title}, coming soon` : `Set up ${focused.metadata.title}`}
              testID={soon ? 'picker-coming-soon' : 'picker-select'}
              style={styles.featuredAction}
            />
          ) : soon ? (
            <PlayroomPill tone="disabled" textStyle={playroomPhone.type.caption}>Coming soon</PlayroomPill>
          ) : null}
        </PhoneCard>
      </Pressable>
      {failure ? <PhoneNotice testID="picker-error">{failure}</PhoneNotice> : null}
      {youAreHost ? (
        <View style={styles.list}>
          {CAROUSEL_REGISTRY.map((module, position) => {
            if (position === index) return null;
            const placeholder = module.placeholder === true;
            const icon = playroomGameArt(module.metadata.id);
            return (
              <Pressable
                key={module.metadata.id}
                onPress={() => onBrowse(position)}
                disabled={busy !== null}
                accessibilityRole="button"
                accessibilityLabel={`${module.metadata.title}${placeholder ? ', coming soon' : ''}`}
                testID={`phone-game-card-${module.metadata.id}`}
                style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
              >
                <View style={[styles.rowIcon, placeholder ? styles.soon : null]}>
                  {icon ? <Image source={icon} style={styles.rowArt} resizeMode="contain" accessible={false} /> : null}
                </View>
                <View style={styles.flex}>
                  <View style={styles.rowTitle}>
                    <PlayroomText color={placeholder ? 'muted' : 'ink'} style={styles.rowName}>
                      {module.metadata.title}
                    </PlayroomText>
                    {placeholder ? (
                      <PlayroomPill tone="disabled" textStyle={playroomPhone.type.caption} style={styles.rowPill}>
                        Coming soon
                      </PlayroomPill>
                    ) : null}
                  </View>
                  <PlayroomText color="muted" numberOfLines={2} style={playroomPhone.type.caption}>
                    {module.metadata.tagline ?? module.metadata.category}
                  </PlayroomText>
                </View>
                {placeholder ? null : <PlayroomText style={styles.chevron}>›</PlayroomText>}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: playroomColors.lavender,
  },
  featured: {
    alignItems: 'center',
    gap: 4,
    paddingTop: 12,
    paddingBottom: 18,
  },
  soon: {
    backgroundColor: playroomColors.disabled,
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
