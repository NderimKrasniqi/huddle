import { playroomColors, playroomMotion, playroomPhone, playroomRadii, playroomShadows } from '@huddle/design-tokens';
import { PlayroomAvatar, PlayroomText } from '@huddle/ui/native';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RosterSeat } from '../../features/room';

const SHOW_MS = 3500;

type Toast = { readonly id: string; readonly text: string; readonly seat: RosterSeat };

export function useHostToast(roster: readonly RosterSeat[], playerId: string): Toast | undefined {
  const host = roster.find((seat) => seat.host);
  const previousHost = useRef<string | undefined>(undefined);
  const [toast, setToast] = useState<Toast>();

  useEffect(() => {
    if (host === undefined) return;
    const before = previousHost.current;
    previousHost.current = host.playerId;
    if (before === undefined || before === host.playerId) return;
    const youAreHost = host.playerId === playerId;
    if (youAreHost) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setToast({ id: `${host.playerId}:${Date.now()}`, text: youAreHost ? 'You’re the host now' : `${host.nickname} is now the host`, seat: host });
  }, [host, playerId]);

  useEffect(() => {
    if (toast === undefined) return;
    const timer = setTimeout(() => setToast(undefined), SHOW_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return toast;
}

export function HostToast({ toast, reduceMotion }: { readonly toast: Toast | undefined; readonly reduceMotion: boolean }) {
  const insets = useSafeAreaInsets();
  if (toast === undefined) return null;
  return (
    <View pointerEvents="none" style={[styles.layer, { top: insets.top + 72 }]}>
      <Animated.View
        key={toast.id}
        entering={reduceMotion ? undefined : FadeInUp.duration(playroomMotion.entrance)}
        exiting={reduceMotion ? undefined : FadeOutUp.duration(playroomMotion.entrance)}
        style={styles.toast}
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={toast.text}
        testID="host-toast"
      >
        <PlayroomAvatar avatarId={toast.seat.avatar} size={32} />
        <PlayroomText numberOfLines={1} style={[playroomPhone.type.label, styles.text]}>{toast.text}</PlayroomText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  toast: {
    maxWidth: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 16,
    borderRadius: playroomRadii.pill,
    backgroundColor: playroomColors.surface,
    borderWidth: 1,
    borderColor: playroomColors.border,
    ...playroomShadows.card,
  },
  text: {
    flexShrink: 1,
  },
});
