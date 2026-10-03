import type { AvatarId } from '@huddle/domain';
import { playroomAvatarCircles, playroomColors, playroomPhone, playroomRadii, playroomShadows } from '@huddle/design-tokens';
import { PlayroomAvatar, PlayroomText, PlayroomWordmark } from '@huddle/ui/native';
import { useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Height of the band in the player's colour below the status bar. */
const BAND = 90;

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
  const moreBelow = useMoreBelow();
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
        testID="phone-frame-scroll"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        scrollEventThrottle={32}
        onLayout={(event) => moreBelow.measure({ viewport: event.nativeEvent.layout.height })}
        onContentSizeChange={(_width, height) => moreBelow.measure({ content: height })}
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => moreBelow.measure({ offset: event.nativeEvent.contentOffset.y })}
      >
        {children}
      </ScrollView>
      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {moreBelow.value ? <ScrollFade /> : null}
          {footer}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Whether scrolled content continues under the footer. Then it fades out above
 * the footer, so a list cut off mid-line reads as "more below", not broken.
 */
function useMoreBelow() {
  const sizes = useRef({ viewport: 0, content: 0, offset: 0 });
  const [value, setValue] = useState(false);
  const measure = (next: Partial<{ viewport: number; content: number; offset: number }>) => {
    Object.assign(sizes.current, next);
    const { viewport, content, offset } = sizes.current;
    const hidden = viewport > 0 && content - (offset + viewport) > 4;
    setValue((current) => (current === hidden ? current : hidden));
  };
  return { value, measure };
}

const FADE_STEPS = 8;
const FADE_STEP_HEIGHT = 4;

/**
 * Content fading into the footer instead of being sliced mid-line. Stacked
 * bands of the canvas colour stand in for a gradient, which would need a
 * native dependency.
 */
function ScrollFade() {
  return (
    <View style={styles.fade} pointerEvents="none" testID="phone-footer-fade">
      {Array.from({ length: FADE_STEPS }, (_unused, step) => (
        <View key={step} style={[styles.fadeBand, { opacity: (step + 1) / FADE_STEPS }]} />
      ))}
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
        You
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
    opacity: 0.12,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: playroomPhone.gutter + 4,
    gap: 16,
  },
  footer: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: playroomColors.canvas,
    paddingHorizontal: playroomPhone.gutter + 4,
    paddingTop: 8,
    gap: 4,
  },
  fade: {
    position: 'absolute',
    top: -FADE_STEPS * FADE_STEP_HEIGHT,
    left: 0,
    right: 0,
  },
  fadeBand: {
    height: FADE_STEP_HEIGHT,
    backgroundColor: playroomColors.canvas,
  },
  topBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  // A back link reads as a control: a white pill like the "You" chip opposite.
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingLeft: 10,
    paddingRight: 16,
    borderRadius: playroomRadii.pill,
    backgroundColor: playroomColors.surface,
    ...playroomShadows.card,
  },
  backChevron: {
    fontSize: 28,
    lineHeight: 30,
    marginTop: -2,
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
