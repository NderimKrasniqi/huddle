import {
  COUNTDOWN_MS,
  settingSummaryText,
} from '@huddle/domain';
import { playroomAvatarCircles, playroomColors, playroomMotion, playroomPhone } from '@huddle/design-tokens';
import {
  PLAYROOM_ARTWORK,
  PlayroomAvatar,
  PlayroomButton,
  PlayroomHeading,
  PlayroomText,
  PlayroomPill,
} from '@huddle/ui/native';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { setupReadiness } from '../seated-phone-model';
import { HostSteps } from './host-steps';
import { PhoneFrame, PhoneNotice, PhoneTopBar } from './phone-frame';
import type { SetupScreenProps } from './setup-screen';
import { setupStyles as styles } from './setup-styles';

/** Everyone raises a hand; the host starts once every hand is up. */
export function ReadyScreen({
  module,
  setup,
  roster,
  playerId,
  you,
  youAreHost,
  busy,
  failure,
  onReopen,
  onReady,
  onStart,
  onLeave,
}: SetupScreenProps) {
  const { allReady, canStart, readyCount, currentReady } = setupReadiness({
    stage: setup.stage,
    playerRange: module.metadata.playerRange,
    roster,
    readyPlayerIds: setup.readyPlayerIds,
    playerId,
  });
  const awayCount = roster.filter((seat) => seat.away).length;
  const countInRange = roster.length >= module.metadata.playerRange.min && roster.length <= module.metadata.playerRange.max;
  const status =
    awayCount > 0
      ? `Reconnecting: ${roster.filter((seat) => seat.away).map((seat) => seat.nickname).join(', ')}.`
      : !countInRange
        ? `Need ${module.metadata.playerRange.min}–${module.metadata.playerRange.max} players to start.`
        : allReady
          ? `Everyone is ready. ${roster.find((seat) => seat.host)?.nickname ?? 'The host'} can start.`
          : `Waiting for ${roster.filter((seat) => !setup.readyPlayerIds.includes(seat.playerId)).map((seat) => seat.nickname).join(', ')}.`;

  function raise() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onReady();
  }

  return (
    <PhoneFrame
      avatarId={you?.avatarId}
      testID="phone-game-setup"
      footer={
        youAreHost ? (
          <>
            <HostSteps current="Ready" />
            <PlayroomButton
              // The waiting line above says who is missing; the button only says what it does.
              label={`Start ${module.metadata.title}`}
                onPress={onStart}
              busy={busy === 'start'}
              disabled={!canStart}
              accessibilityLabel={`Start ${module.metadata.title}`}
              testID="start-game"
            />
            <PlayroomText color="muted" style={[playroomPhone.type.caption, styles.center]}>Starts with a five-second countdown.</PlayroomText>
          </>
        ) : (
          <PlayroomButton label="Leave room" variant="link" onPress={onLeave} accessibilityLabel="Leave room" testID="setup-leave" />
        )
      }
    >
      <PhoneTopBar back={youAreHost ? { label: 'Setup', onPress: onReopen, testID: 'setup-nav-back' } : undefined} you={you} />
      {/* What the hand is for: a guest never saw setup, so name the game and how it's set. */}
      {youAreHost ? null : (
        <View style={styles.readyContext} testID="ready-game-context">
          <PlayroomHeading type={playroomPhone.type.title}>{module.metadata.title}</PlayroomHeading>
          <View style={styles.summaryChips} accessible accessibilityLabel={module.settingsSchema.map((setting) => settingSummaryText(setting, setup.settings[setting.key] ?? setting.defaultValue)).join(', ')}>
            {module.settingsSchema.map((setting) => (
              <PlayroomPill key={setting.key} textStyle={playroomPhone.type.caption}>
                {settingSummaryText(setting, setup.settings[setting.key] ?? setting.defaultValue)}
              </PlayroomPill>
            ))}
          </View>
        </View>
      )}
      {/* The hand sits in the lower half, where a thumb reaches it. */}
      <View style={styles.thumbSpacer} />
      {/* One message: the hand and what it means. Settings and the count live on the TV. */}
      <Pressable
        onPress={raise}
        disabled={busy === 'ready'}
        accessibilityRole="button"
        accessibilityLabel={currentReady ? 'Mark not ready' : 'Mark ready'}
        accessibilityState={{ selected: currentReady, disabled: busy === 'ready' }}
        testID="toggle-game-ready"
        style={({ pressed }) => [styles.raise, pressed ? styles.raisePressed : null]}
      >
        <View style={[styles.disc, currentReady ? styles.discUp : null]}>
          <Image
            source={PLAYROOM_ARTWORK.props.hand}
            style={[styles.hand, currentReady ? { tintColor: playroomColors.success } : null]}
            resizeMode="contain"
            accessible={false}
          />
        </View>
        <PlayroomText style={playroomPhone.type.heading}>{currentReady ? 'Hands up!' : 'Raise your hand'}</PlayroomText>
      </Pressable>
      {/* The host sees everyone below, so the count is the guests' summary only. */}
      <PlayroomText color="muted" style={[playroomPhone.type.body, styles.center]}>
        {youAreHost ? status : `${readyCount} of ${roster.length} hands up`}
      </PlayroomText>
      {youAreHost && roster.length > 0 ? (
        <View style={styles.waiting} accessible accessibilityLabel={`Players: ${roster.map((seat) => `${seat.nickname}, ${seat.away ? 'reconnecting' : setup.readyPlayerIds.includes(seat.playerId) ? 'ready' : 'waiting'}`).join('; ')}`}>
          {roster.map((seat) => <View key={seat.playerId} style={[styles.readyPerson, !seat.away && setup.readyPlayerIds.includes(seat.playerId) ? styles.readyPersonUp : null]}>
            <PlayroomAvatar avatarId={seat.avatar} size={36} away={seat.away} />
            <PlayroomText color={seat.away ? 'muted' : setup.readyPlayerIds.includes(seat.playerId) ? 'success' : 'ink'} style={playroomPhone.type.caption}>{seat.nickname}</PlayroomText>
          </View>)}
        </View>
      ) : null}
      {failure ? <PhoneNotice testID="setup-error">{failure}</PhoneNotice> : null}
      <View style={styles.thumbSpacerBelow} />
    </PhoneFrame>
  );
}

/**
 * The countdown on the phone: the same seconds as the TV, a haptic tick and
 * a flash of your colour each second, and a way to stop it.
 */
export function CountdownScreen({
  module,
  you,
  youAreHost,
  busy,
  failure,
  onReady,
  onStop,
  countdownEndsAt,
}: SetupScreenProps & { readonly countdownEndsAt: number }) {
  const seconds = useSecondsLeft(countdownEndsAt);
  const flash = useSharedValue(0);
  useEffect(() => {
    if (seconds <= 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    flash.set(1);
    flash.set(withTiming(0, { duration: playroomMotion.highlight }));
  }, [flash, seconds]);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() }));

  return (
    <PhoneFrame
      avatarId={you?.avatarId}
      testID="phone-game-countdown"
      footer={
        <PlayroomButton
          label={youAreHost ? 'Stop the countdown' : 'Wait, I’m not ready'}
          variant="link"
          onPress={youAreHost && onStop ? onStop : onReady}
          busy={busy === 'stop' || busy === 'ready'}
          testID="stop-countdown"
        />
      }
      contentStyle={styles.countdown}
      backdrop={
        you ? (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: playroomAvatarCircles[you.avatarId] }, flashStyle]}
          />
        ) : undefined
      }
    >
      <PhoneTopBar you={you} />
      <View style={styles.flex} />
      <PlayroomHeading type={playroomPhone.type.heading}>{`${module.metadata.title} starts in`}</PlayroomHeading>
      <View style={styles.ring} accessible accessibilityLabel={seconds > 0 ? `${seconds}` : 'Go'} accessibilityLiveRegion="polite">
        <PlayroomText style={seconds > 0 ? styles.number : styles.go}>{seconds > 0 ? String(seconds) : 'Go!'}</PlayroomText>
      </View>
      <PlayroomText style={[playroomPhone.type.title, styles.center]}>Eyes on the TV!</PlayroomText>
      {failure ? <PhoneNotice testID="setup-error">{failure}</PhoneNotice> : null}
      <View style={styles.flex} />
    </PhoneFrame>
  );
}

/** Whole seconds until the deadline on this phone's clock, 0 once it passes. */
export function useSecondsLeft(endsAt: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [endsAt]);
  const left = Math.ceil((endsAt - now) / playroomMotion.tick);
  return Math.min(Math.max(left, 0), Math.ceil(COUNTDOWN_MS / playroomMotion.tick));
}
