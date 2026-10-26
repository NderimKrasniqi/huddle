import type { AvatarId } from '@huddle/domain';
import { playroomAvatarCircles, playroomColors, playroomEasing, playroomMotion, playroomPhone, playroomRadii, playroomShadows } from '@huddle/design-tokens';
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
import Animated, { Easing, Keyframe, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BAND = 90;

export type PhoneFrameProps = {
  readonly children: ReactNode;
  readonly avatarId?: AvatarId;
  readonly footer?: ReactNode;
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly backdrop?: ReactNode;
  readonly testID?: string;
};

export function PhoneFrame({ children, avatarId, footer, contentStyle, backdrop, testID }: PhoneFrameProps) {
  const insets = useSafeAreaInsets();
  const moreBelow = useMoreBelow();
  return (
    <View style={styles.screen} testID={testID}>
      {backdrop}
      {avatarId ? (
        <View
          style={[styles.band, { height: insets.top + BAND, backgroundColor: playroomAvatarCircles[avatarId] }]}
          pointerEvents="none"
        />
      ) : null}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: footer ? 16 : insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        testID="phone-frame-scroll"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        scrollEventThrottle={32}
        onLayout={(event) => moreBelow.measure({ viewport: event.nativeEvent.layout.height })}
        onContentSizeChange={(_width, height) => moreBelow.measure({ content: height })}
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => moreBelow.measure({ offset: event.nativeEvent.contentOffset.y })}
      >
        <Animated.View entering={STEP_ENTER} style={[styles.stepBody, contentStyle]}>
          {children}
        </Animated.View>
      </ScrollView>
      {footer ? (
        <View style={[styles.footer, backdrop ? styles.footerClear : null, { paddingBottom: insets.bottom + 12 }]}>
          {moreBelow.value ? <ScrollFade /> : null}
          {footer}
        </View>
      ) : null}
    </View>
  );
}

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

const STEP_ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: playroomMotion.entranceTravel }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.bezier(...playroomEasing.out) },
})
  .duration(playroomMotion.entrance)
  .reduceMotion(ReduceMotion.System);

const FADE_STEPS = 8;
const FADE_STEP_HEIGHT = 4;

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
  readonly back?: { readonly label: string; readonly onPress: () => void; readonly testID?: string };
  readonly you?: { readonly nickname: string; readonly avatarId: AvatarId; readonly roomCode?: string };
};

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
      {you ? <YouChip nickname={you.nickname} avatarId={you.avatarId} roomCode={you.roomCode} /> : null}
    </View>
  );
}

function YouChip({ nickname, avatarId, roomCode }: { readonly nickname: string; readonly avatarId: AvatarId; readonly roomCode?: string }) {
  const room = roomCode ? ` in room ${roomCode.split('').join(' ')}` : '';
  return (
    <View style={styles.you} accessible accessibilityLabel={`You are ${nickname}${room}`} testID="phone-you-chip">
      <PlayroomAvatar avatarId={avatarId} size={30} />
      <PlayroomText numberOfLines={1} style={[playroomPhone.type.caption, styles.youName]}>
        {roomCode ? `You · ${roomCode}` : 'You'}
      </PlayroomText>
    </View>
  );
}

export function PhoneCard({ children, style }: { readonly children: ReactNode; readonly style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

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
  stepBody: {
    flexGrow: 1,
    gap: 16,
  },
  footerClear: {
    backgroundColor: 'transparent',
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
