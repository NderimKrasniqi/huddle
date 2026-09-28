import type { AvatarId } from '@huddle/domain';
import { playroomAvatarCircles, playroomColors, playroomPhone, playroomRadii, playroomShadows } from '@huddle/design-tokens';
import { PlayroomAvatar, PlayroomText, PlayroomWordmark } from '@huddle/ui/native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Height of the band in the player's colour below the status bar. */
const BAND = 150;

export type PhoneFrameProps = {
  readonly children: ReactNode;
  /** The seated player's avatar: the header band takes its circle colour. */
  readonly avatarId?: AvatarId;
  /** Pinned to the bottom, outside the scrolling content. */
  readonly footer?: ReactNode;
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly testID?: string;
};

/**
 * A seated phone screen: canvas background, a header band in your avatar's
 * colour so everyone can tell whose phone is whose, scrolling content, and
 * an optional footer for the main action.
 */
export function PhoneFrame({ children, avatarId, footer, contentStyle, testID }: PhoneFrameProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen} testID={testID}>
      {avatarId ? (
        <View
          style={[styles.band, { height: insets.top + BAND, backgroundColor: playroomAvatarCircles[avatarId] }]}
          pointerEvents="none"
        />
      ) : null}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: footer ? 16 : insets.bottom + 24 }, contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>{footer}</View> : null}
    </View>
  );
}

export type PhoneTopBarProps = {
  /** A back link on the left; the wordmark shows when there is none. */
  readonly back?: { readonly label: string; readonly onPress: () => void; readonly testID?: string };
  readonly you?: { readonly nickname: string; readonly avatarId: AvatarId };
};

/** Back link or wordmark on the left, and who this phone belongs to on the right. */
export function PhoneTopBar({ back, you }: PhoneTopBarProps) {
  return (
    <View style={styles.topBar}>
      {back ? (
        <Pressable
          onPress={back.onPress}
          accessibilityRole="button"
          accessibilityLabel={back.label}
          hitSlop={12}
          testID={back.testID}
          style={styles.back}
        >
          <PlayroomText style={styles.backChevron}>‹</PlayroomText>
          <PlayroomText style={playroomPhone.type.label}>{back.label}</PlayroomText>
        </Pressable>
      ) : (
        <PlayroomWordmark height={34} />
      )}
      {you ? <YouChip nickname={you.nickname} avatarId={you.avatarId} /> : null}
    </View>
  );
}

function YouChip({ nickname, avatarId }: { readonly nickname: string; readonly avatarId: AvatarId }) {
  return (
    <View style={styles.you} accessible accessibilityLabel={`You are ${nickname}`} testID="phone-you-chip">
      <PlayroomAvatar avatarId={avatarId} size={30} />
      <PlayroomText numberOfLines={1} style={[playroomPhone.type.caption, styles.youName]}>
        {`You · ${nickname}`}
      </PlayroomText>
    </View>
  );
}

/** A white card, for featured content and grouped rows. */
export function PhoneCard({ children, style }: { readonly children: ReactNode; readonly style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** An error or status line under the controls it concerns. */
export function PhoneNotice({ children, testID }: { readonly children: string; readonly testID?: string }) {
  return (
    <PlayroomText color="danger" style={[playroomPhone.type.caption, styles.notice]} accessibilityRole="alert" testID={testID}>
      {children}
    </PlayroomText>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: playroomColors.canvas,
  },
  band: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: playroomPhone.gutter + 4,
    gap: 16,
  },
  footer: {
    paddingHorizontal: playroomPhone.gutter + 4,
    paddingTop: 8,
    gap: 4,
  },
  topBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: playroomPhone.minTarget,
  },
  backChevron: {
    fontSize: 30,
    lineHeight: 32,
  },
  you: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 180,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
    borderRadius: playroomRadii.pill,
    backgroundColor: playroomColors.surface,
    ...playroomShadows.card,
  },
  youName: {
    flexShrink: 1,
  },
  card: {
    borderRadius: playroomRadii.card,
    backgroundColor: playroomColors.surface,
    padding: 16,
    ...playroomShadows.card,
  },
  notice: {
    textAlign: 'center',
  },
});
